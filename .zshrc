alias pip=pip3
alias vim=nvim

export RUBY_CONFIGURE_OPTS="--with-openssl-dir=$(brew --prefix openssl@1.1)"
export PATH="$HOME/.rbenv/shims:$PATH"
export PATH="$HOME/.mix/escripts:$PATH"
eval "$(rbenv init -)"
export PATH="$PATH:/Users/tolsee/dev/bastion-cli"

# Add zplug
export ZPLUG_HOME=/opt/homebrew/opt/zplug
source $ZPLUG_HOME/init.zsh

zplug "mafredri/zsh-async"
zplug "sindresorhus/pure"
zplug "lukechilds/zsh-nvm"
zplug "zsh-users/zsh-syntax-highlighting"
zplug "zsh-users/zsh-completions"
zplug "Aloxaf/fzf-tab"

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
export JAVA_HOME=$(/usr/libexec/java_home)
export PATH="$PATH:/Users/tolsee/Library/Java/JavaVirtualMachines/adopt-openj9-1.8.0_272/Contents/Home/bin"
export PATH="$PATH:$ANT_HOME/bin"

# AWS 
# export AWS_PROFILE=zenledger-oracle
export AWS_PROFILE=zenledger
# export AWS_PROFILE=zen-lambda

# Golang
export GOPATH=$HOME/go
export PATH=$PATH:$GOPATH/bin
