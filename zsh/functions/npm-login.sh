npm-login() {
  npm login "$@"
  export NPM_TOKEN="$(grep -E '^//registry\.npmjs\.org/:_authToken=' ~/.npmrc | tail -n1 | cut -d= -f2-)"
  echo "NPM_TOKEN refreshed"
}
