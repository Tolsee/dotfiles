alias pip=pip3
alias vim=nvim
alias cat=bat

export RUBY_CONFIGURE_OPTS="--with-openssl-dir=$(brew --prefix openssl@1.1)"
export PATH="$HOME/.rbenv/shims:$PATH"
export PATH="$HOME/.mix/escripts:$PATH"
eval "$(rbenv init -)"
export PATH="$HOME/.tmuxifier/bin:$PATH"
eval "$(tmuxifier init -)"

# Python 
export PATH="$HOME/Library/Python/3.9/bin:$PATH"

# PKL lang
export PATH="$HOME/.pkl/bin:$PATH"

# ZVM (Zig Version Manager)
export ZVM_INSTALL="$HOME/.zvm/self"
export PATH="$PATH:$HOME/.zvm/bin"
export PATH="$PATH:$ZVM_INSTALL/"

# ----------
# UTF-8 support
# ----------
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8

# ----------
# spaceship-prompt configurations
# ----------
SPACESHIP_DIR_TRUNC=0
SPACESHIP_DIR_TRUNC_REPO=false
SPACESHIP_AWS_SHOW=true
SPACESHIP_DOCKER_SHOW=false
SPACESHIP_DOCKER_COMPOSE_SHOW=false
SPACESHIP_KUBECTL_SHOW=false
SPACESHIP_CHAR_SYMBOL="❯ "
SPACESHIP_PACKAGE_SHOW=true
SPACESHIP_NODE_SHOW=true
SPACESHIP_GCLOUD_SHOW=false

# Add zplug
export ZPLUG_HOME=/opt/homebrew/opt/zplug
source $ZPLUG_HOME/init.zsh

zplug "mafredri/zsh-async"
zplug "lukechilds/zsh-nvm"
zplug "zsh-users/zsh-syntax-highlighting"
zplug "zsh-users/zsh-completions"
zplug "Aloxaf/fzf-tab"
zplug "spaceship-prompt/spaceship-prompt", use:spaceship.zsh, from:github

zplug load

# Make colors available
autoload -U colors
colors

# Enable colored output
export CLICOLOR=1

# Add my tools
alias be='bundle exec'
alias autorubo='be rubocop -a'

# Golang
export GOPATH=$HOME/go
export PATH=$PATH:$GOPATH/bin

# Moon repo cli
export PATH=$PATH:$HOME/.moon/bin

# ----------
# Google cloud
# ----------
# The next line updates PATH for the Google Cloud SDK.
if [ -f '/Users/tolsee/google-cloud-sdk/path.zsh.inc' ]; then . '/Users/tolsee/google-cloud-sdk/path.zsh.inc'; fi
# The next line enables shell command completion for gcloud.
if [ -f '/Users/tolsee/google-cloud-sdk/completion.zsh.inc' ]; then . '/Users/tolsee/google-cloud-sdk/completion.zsh.inc'; fi
export USE_GKE_GCLOUD_AUTH_PLUGIN=True

# --------
# Zsh functions
# --------
for f in ~/.config/zsh-functions/*.sh; do source "$f"; done

# --------
# NPM
# --------
export NPM_TOKEN="$(grep -E '^//registry\.npmjs\.org/:_authToken=' ~/.npmrc | tail -n1 | cut -d= -f2-)"

# --------
# Secrets
# --------
source ~/.secrets.zshrc

# --------
# Autocompletion
# --------
source <(kubectl completion zsh)
autoload -U +X bashcompinit && bashcompinit
complete -o nospace -C /opt/homebrew/bin/terraform terraform
complete -o nospace -C /opt/homebrew/bin/helmfile helmfile
source <(helmfile completion zsh)
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"


# --------
# Zoxide
# --------
eval "$(zoxide init --cmd cd zsh)"

# --------
# Projects
# --------
alias bbinfra='tmuxifier load-session blockbase-infrastructure'
alias minfra='tmuxifier load-session mintly-infrastructure'
alias binfra='tmuxifier load-session base-infrastructure'
alias sbuild='tmuxifier load-session shared-build-tools'
alias bbbuild='tmuxifier load-session blockbase-build-tools'
alias mbuild='tmuxifier load-session mintly-build-tools'
alias blockbase='tmuxifier load-session blockbase'
alias mintly='tmuxifier load-session mintly'
alias plat='tmuxifier load-session platform'
alias sensand='tmuxifier load-session sensand'
alias data-pipeline='tmuxifier load-session data-pipeline'

complete -o nospace -C /opt/homebrew/bin/vault vault

# -----
# NVM
# -----
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"  # This loads nvm
[ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"  # This loads nvm bash_completion

# proto
export PROTO_HOME="$HOME/.proto"
export PATH="$PROTO_HOME/shims:$PROTO_HOME/bin:$PATH"

LTD_AC_ZSH_SETUP_PATH=/Users/tolsee/Library/Caches/ltd/autocomplete/zsh_setup && test -f $LTD_AC_ZSH_SETUP_PATH && source $LTD_AC_ZSH_SETUP_PATH; # ltd autocomplete setup

# amp
export PATH="$HOME/.local/bin:$PATH"
export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"

alias claude-mem='bun "/Users/tolsee/.claude/plugins/marketplaces/thedotmack/plugin/scripts/worker-service.cjs"'
