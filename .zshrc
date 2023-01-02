alias pip=pip3
alias vim=nvim
alias cat=bat

export RUBY_CONFIGURE_OPTS="--with-openssl-dir=$(brew --prefix openssl@1.1)"
export PATH="$HOME/.rbenv/shims:$PATH"
export PATH="$HOME/.mix/escripts:$PATH"
eval "$(rbenv init -)"
export PATH="$PATH:/Users/tolsee/dev/bastion-cli"

SPACESHIP_DIR_TRUNC=0
SPACESHIP_DIR_TRUNC_REPO=false
SPACESHIP_DOCKER_SHOW=false
SPACESHIP_DOCKER_COMPOSE_SHOW=false
SPACESHIP_CHAR_SYMBOL="❯ "
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
# TODO: To github
alias be='bundle exec'
alias autorubo='be rubocop -a'

# TODO: Remove this
export ANT_HOME=/usr/local/Cellar/ant/1.10.9/libexec
alias ant='. ../Support/vm.sh && $ANT_HOME/bin/ant'
# export JAVA_HOME=$(/usr/libexec/java_home)
# export PATH="$PATH:/Users/tolsee/Library/Java/JavaVirtualMachines/adopt-openj9-1.8.0_272/Contents/Home/bin"
export PATH="$PATH:$ANT_HOME/bin"

# AWS 
# export AWS_PROFILE=zenledger-oracle
export AWS_PROFILE=zenledger
# export AWS_PROFILE=zen-lambda

# Golang
export GOPATH=$HOME/go
export PATH=$PATH:$GOPATH/bin


# ----------
# Google cloud
# ----------
# The next line updates PATH for the Google Cloud SDK.
if [ -f '/Users/tolsee/google-cloud-sdk/path.zsh.inc' ]; then . '/Users/tolsee/google-cloud-sdk/path.zsh.inc'; fi
# The next line enables shell command completion for gcloud.
if [ -f '/Users/tolsee/google-cloud-sdk/completion.zsh.inc' ]; then . '/Users/tolsee/google-cloud-sdk/completion.zsh.inc'; fi
export USE_GKE_GCLOUD_AUTH_PLUGIN=True

# --------
# Secrets
# --------
source ~/.secrets.zshrc
