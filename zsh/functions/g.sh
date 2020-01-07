# With no arguments: 	`git status`
# With arguments: 	`git arguments` 
g() {
  if [[ $# -gt 0 ]]; then
    git "$@"
  else
    git status
  fi
}

# Completion
compdef g=git
