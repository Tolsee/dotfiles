# Nimble git tools
NIMBLE_JIRA_TICKET_FILE=$HOME/.nimble_jira_ticket

function normalize_current_branch() {
	branch=$(git rev-parse --abbrev-ref HEAD)
	normal=$(echo $branch | tr '/' '_' | tr '-' '_')
	echo "${normal}_jira"
}

function remove_if_present() {
	sed -i '' "/$1/d" $JIRA_TICKET_FILE 
}

function create_env_file() {
	if [[ ! -f $JIRA_TICKET_FILE ]]; then
		touch $JIRA_TICKET_FILE
	fi
}


function get_jira() {
	branch=$(normalize_current_branch)
	sed -n "s/^$branch=//p" $JIRA_TICKET_FILE
}

function set_jira() {
	branch=$(normalize_current_branch)
	remove_if_present "$branch"
	echo "$branch=$1" >> $JIRA_TICKET_FILE
}

function ncommit() {
	jira_ticket=$(get_jira)
	git commit -m "[$jira_ticket] $1"
}
