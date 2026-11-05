// prefix+m (keys.json "mod.open:task-prs"): GitHub pull requests in a popup, the app's
// version of the TUI's herdr-github: mine, waiting for my review, and the focused repo's,
// each with CI, review and draft state. GitHub search takes ~3 s, so the popup opens on the
// lists it fetched last time (shared state) and refreshes them.
//
// Keys: j/k or ↑/↓ move, h/l, ←/→ or 1-3 switch list, Enter opens the PR, w opens its branch
// as a worktree space (herdr-task prepare, in the matching repo under the project roots),
// y copies the link, r refreshes, Esc closes. Merging stays in the browser.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { focused, spaces, panes, theme, run, exec, props, closeOverlay, notify, shared, setShared, window } from "herdr";

const CACHE = "task-prs.lists";
const VISIBLE = 10;
const LISTS = [["mine", "Mine"], ["review", "Review"], ["repo", "This repo"]];
const icon = (name) => svg(`mods/workspace-chrome/${name}.svg`).size(13).flex_none();

const FIELDS = `number title url isDraft updatedAt headRefName isCrossRepository author { login } reviewDecision
  repository { nameWithOwner } commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }`;
export const QUERIES = {
  mine: "is:pr is:open author:@me archived:false sort:updated-desc",
  review: "is:pr is:open review-requested:@me archived:false sort:updated-desc",
  repo: (slug) => `is:pr is:open repo:${slug} sort:updated-desc`,
};

// One search, flattened to what a row needs.
export async function search(query) {
  const r = await exec("gh", ["api", "graphql",
    "-f", `query=query($q: String!) { s: search(query: $q, type: ISSUE, first: 25) { nodes { ... on PullRequest { ${FIELDS} } } } }`,
    "-f", `q=${query}`]);
  if (r.code !== 0) throw new Error(r.stderr.trim().split("\n").pop() || "gh api graphql failed");
  return (JSON.parse(r.stdout).data?.s?.nodes ?? []).filter((n) => n?.url).map((n) => ({
    number: n.number, title: n.title, url: n.url, draft: n.isDraft, branch: n.headRefName, fork: Boolean(n.isCrossRepository),
    author: n.author?.login ?? "", review: n.reviewDecision, repo: n.repository?.nameWithOwner ?? "",
    ci: n.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state ?? null,
  }));
}

export const slugOf = (remote) => String(remote ?? "").trim().replace(/\.git$/, "").match(/github\.com[:/]([^/]+\/[^/]+)$/)?.[1] ?? null;

// herdr-task with the private shell config (HERDR_TASK_PROJECT_ROOTS), as the TUI popups run it.
function herdrTask(args) {
  return exec("zsh", ["-c", 'source ~/.secrets.zshrc 2>/dev/null; exec ~/bin/herdr-task "$@"', "herdr-task", ...args]);
}

// The local checkout of owner/name among the project roots: same folder name, origin pointing there.
export async function localRepo(slug, projects) {
  const name = slug.split("/").pop().toLowerCase();
  for (const p of projects.filter((p) => p.split("/").pop().toLowerCase() === name)) {
    const r = await exec("git", ["remote", "get-url", "origin"], { cwd: p }).catch(() => null);
    if (slugOf(r?.stdout)?.toLowerCase() === slug.toLowerCase()) return p;
  }
  return null;
}

export default class TaskPrs extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(600, () => this.handle.focus());
    this.list = "mine";
    this.at = 0;
    this.top = 0;
    this.busy = false;
    this.error = null;
    const cached = shared(CACHE) ?? {};
    this.lists = { mine: cached.mine ?? null, review: cached.review ?? null, repo: cached.repo ?? null };
    this.slug = cached.repoSlug ?? null; // until git says which repo is focused
    this.refresh(cx);
  }

  dismiss() {
    closeOverlay(props().overlay);
  }

  rows() {
    return this.lists[this.list] ?? [];
  }

  refresh(cx) {
    this.loading = true;
    this.error = null;
    cx.spawn(async (cx) => {
      const f = focused();
      const on = spaces().find((s) => s.id === f?.space)?.machine ?? null; // a remote space's folder is there
      const slug = f?.cwd ? slugOf((await exec("git", ["remote", "get-url", "origin"], { cwd: f.cwd, on }).catch(() => null))?.stdout) : null;
      if (slug !== this.slug) this.lists.repo = slug ? null : []; // the cached list was another repo's
      this.slug = slug;
      cx.notify();
      const names = this.slug ? ["mine", "review", "repo"] : ["mine", "review"];
      const got = await Promise.allSettled(names.map((n) => search(n === "repo" ? QUERIES.repo(this.slug) : QUERIES[n])));
      got.forEach((g, i) => {
        if (g.status === "fulfilled") this.lists[names[i]] = g.value;
        else this.error = String(g.reason?.message ?? g.reason);
      });
      setShared(CACHE, { mine: this.lists.mine, review: this.lists.review, repo: this.slug ? this.lists.repo : null, repoSlug: this.slug });
      this.loading = false;
      cx.notify();
    });
  }

  open(pr) {
    if (!pr) return;
    this.dismiss();
    exec(window()?.platform === "macos" ? "open" : "xdg-open", [pr.url]).catch(() => null);
  }

  worktree(pr, cx) {
    if (!pr || this.busy) return;
    this.busy = true;
    this.error = null;
    cx.spawn(async (cx) => {
      try {
        const listed = await herdrTask(["projects"]);
        const repo = await localRepo(pr.repo, listed.code === 0 ? JSON.parse(listed.stdout).projects : []);
        if (!repo) throw new Error(`No checkout of ${pr.repo} under the project roots`);
        // A fork's branch is not on origin: take the PR's head into its own local branch.
        // Same-repo branches come from origin in prepare, which fetches and tracks them.
        let branch = pr.branch;
        if (pr.fork) {
          branch = `pr-${pr.number}`;
          // Once fetched, pr-<n> is kept as it is (it may be checked out, or hold review
          // commits): prepare reopens it. Pull it there for newer commits.
          const have = await exec("git", ["show-ref", "-q", "--verify", `refs/heads/${branch}`], { cwd: repo });
          if (have.code !== 0) {
            const f = await exec("git", ["fetch", "-q", "origin", `pull/${pr.number}/head:${branch}`], { cwd: repo });
            if (f.code !== 0) throw new Error(f.stderr.trim().split("\n").pop() || `git fetch pull/${pr.number}/head failed`);
          }
        }
        const r = await herdrTask(["prepare", branch, "--project", repo, "--title", pr.title, "--agent", "none"]);
        if (r.code !== 0) throw new Error(r.stderr.trim().split("\n").pop()?.replace(/^herdr-task: /, "") || "herdr-task prepare failed");
        const p = JSON.parse(r.stdout);
        const local = spaces().filter((s) => (s.machine ?? null) === null);
        const spaceOf = new Map(local.flatMap((s) => (s.tabs ?? []).map((t) => [t.id, s.id])));
        const id = local.find((s) => s.folder === p.path)?.id
          ?? spaceOf.get(panes().find((x) => spaceOf.has(x.tab) && (x.cwd === p.path || x.cwd?.startsWith(`${p.path}/`)))?.tab);
        if (id) run("space.select", { id });
        else run("space.new", { name: `#${pr.number} ${pr.title}`.slice(0, 48), folder: p.path, machine: "" });
        this.dismiss();
        notify({ title: `#${pr.number}`, body: id ? "Went to its space" : `Worktree on ${p.branch}`, level: "info", timeout: 4 });
      } catch (e) {
        this.error = String(e?.message ?? e);
      }
      this.busy = false;
      cx.notify();
    });
  }

  key(e, cx) {
    const k = e.key, n = this.rows().length;
    if (e.modifiers?.control || e.modifiers?.platform || e.modifiers?.alt) return false;
    const go = (i) => { this.list = LISTS[(i + LISTS.length) % LISTS.length][0]; this.at = 0; this.top = 0; };
    const now = LISTS.findIndex(([id]) => id === this.list);
    if (k === "escape") this.dismiss();
    else if (k === "down" || k === "j") this.at = n ? (this.at + 1) % n : 0;
    else if (k === "up" || k === "k") this.at = n ? (this.at + n - 1) % n : 0;
    else if (k === "right" || k === "l") go(now + 1);
    else if (k === "left" || k === "h") go(now - 1);
    else if (/^[1-3]$/.test(k)) go(Number(k) - 1);
    else if (k === "enter") this.open(this.rows()[this.at]);
    else if (k === "w") this.worktree(this.rows()[this.at], cx);
    else if (k === "y" && this.rows()[this.at]) {
      cx.write_to_clipboard(this.rows()[this.at].url);
      notify({ title: "Link copied", body: this.rows()[this.at].url, level: "info", timeout: 2 });
    } else if (k === "r") this.refresh(cx);
    else return false;
    return true;
  }

  first(n) {
    this.top = Math.min(Math.max(0, n - VISIBLE), Math.max(this.top, this.at - VISIBLE + 1));
    if (this.at < this.top) this.top = this.at;
    return this.top;
  }

  render() {
    const t = theme();
    const rows = this.rows();
    this.at = Math.min(this.at, Math.max(0, rows.length - 1));
    const top = this.first(rows.length);
    const tag = (text, color) => div().flex_none().px(6).py(1).rounded(4).border_1().border_color(color).text_size(10.5).text_color(color).child(text);
    const ciIcon = (ci) => ci === "SUCCESS" ? icon("circle-check").text_color(t.done)
      : ci === "FAILURE" || ci === "ERROR" ? icon("x").text_color(t.blocked)
      : ci ? icon("clock").text_color(t.working ?? t.muted) : div().w(13).flex_none();
    const row = (pr, i) => {
      const on = i === this.at;
      const review = { APPROVED: ["approved", t.done], CHANGES_REQUESTED: ["changes", t.blocked] }[pr.review];
      return h_flex().id(`pr-${i}`).h(34).px(10).gap(10).items_center().rounded(7).cursor_pointer()
        .when(on, (el) => el.bg(t.hover)).hover((s) => s.bg(t.hover))
        .on_click(() => this.open(pr))
        .child(ciIcon(pr.ci))
        .child(div().flex_none().text_size(11.5).text_color(t.dim).child(`#${pr.number}`))
        .child(div().flex_1().truncate().text_color(t.foreground).child(pr.title))
        .when(this.list !== "repo", (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(pr.repo.split("/").pop())))
        .when(this.list !== "mine", (el) => el.child(div().flex_none().text_size(11).text_color(t.muted).child(pr.author)))
        .when(pr.draft, (el) => el.child(tag("draft", t.dim)))
        .when(Boolean(review), (el) => el.child(tag(...review)));
    };
    const tab = ([id, label], i) => {
      const on = id === this.list, n = this.lists[id]?.length;
      return h_flex().id(`prs-tab-${id}`).px(10).py(4).gap(6).rounded(6).items_center().cursor_pointer()
        .when(on, (el) => el.bg(t.selected ?? t.hover))
        .on_click((_e, cx) => { this.list = id; this.at = 0; cx.notify(); })
        .child(div().text_size(10.5).text_color(t.dim).child(String(i + 1)))
        .child(div().text_color(on ? t.foreground : t.muted).when(on, (d) => d.font_semibold())
          .child(id === "repo" && this.slug ? this.slug.split("/").pop() : label))
        .when(n != null, (el) => el.child(div().text_size(11).text_color(t.dim).child(String(n))));
    };
    const empty = this.lists[this.list] == null ? "Loading…"
      : this.list === "repo" && !this.slug ? "The focused folder is not a GitHub repository" : "No open pull requests";
    const hint = (k, what) => h_flex().gap(4).child(div().px(5).rounded(3).bg(t.raised).text_color(t.muted).child(k)).child(what);
    return v_flex().id("task-prs").track_focus(this.handle).w_full().p(16).gap(10).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        if (this.key(e, cx)) { cx.stop_propagation(); cx.notify(); }
      })
      .child(h_flex().items_center().gap(10)
        .child(div().text_size(15).font_semibold().text_color(t.foreground).child("Pull requests"))
        .child(h_flex().flex_1().gap(4).children(LISTS.map(tab)))
        .when(this.loading || this.busy, (el) => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).text_color(t.working ?? t.dim).spin(900))))
      .child(v_flex().gap(2)
        .when(!rows.length, (el) => el.child(div().px(10).py(8).text_color(t.dim).child(empty)))
        .children(rows.slice(top, top + VISIBLE).map((pr, i) => row(pr, top + i)))
        .when(rows.length > VISIBLE, (el) => el.child(div().px(10).text_size(11).text_color(t.dim).child(`${this.at + 1} of ${rows.length}`))))
      .when(Boolean(this.error), (el) => el.child(div().px(10).text_color(t.blocked).child(this.error ?? "")))
      .child(h_flex().pt(6).gap(14).border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
        .child(hint("↵", "open")).child(hint("w", "worktree")).child(hint("h/l", "list")).child(hint("y", "copy"))
        .child(hint("r", "refresh")).child(hint("esc", "close")));
  }
}
