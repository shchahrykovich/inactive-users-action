/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 327:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const Organization = __nccwpck_require__(615)
  , RepositoryActivity = __nccwpck_require__(355)
  , UserActivity = __nccwpck_require__(616)
;


module.exports = class OrganizationUserActivity {

  constructor(octokit) {
    this._organization = new Organization(octokit);
    this._repositoryActivity = new RepositoryActivity(octokit);
  }

  get organizationClient() {
    return this._organization;
  }

  get repositoryClient() {
    return this._repositoryActivity;
  }

  async getUserActivity(org, since) {
    const self = this;

    const repositories = await self.organizationClient.getRepositories(org)
      , orgUsers = await self.organizationClient.findUsers(org)
    ;

    const activityResults = {};
    for(let idx = 0; idx< repositories.length; idx++) {
      const repoActivity = await self.repositoryClient.getActivity(repositories[idx], since);
      Object.assign(activityResults, repoActivity);
    }

    const userActivity = generateUserActivityData(activityResults);

    orgUsers.forEach(user => {
      if (userActivity[user.login]) {
        if (user.email && user.email.length > 0) {
          userActivity[user.login] = user.email;
        }
      } else {
        const userData = new UserActivity(user.login);
        userData.email = user.email;
        userData.url = user.url;
        userData.name = user.name;

        userActivity[user.login] = userData
      }
    });

    // An array of user activity objects
    return Object.values(userActivity);
  }
}

function generateUserActivityData(data) {
  if (!data) {
    return null
  }

  // Use an object to ensure unique user to activity based on user key
  const results = {};

  function process(repo, values, activityType) {
    if (values) {
      Object.keys(values).forEach(login => {
        if (!results[login]) {
          results[login] = new UserActivity(login);
        }

        results[login].increment(activityType, repo, values[login]);
      })
    }
  }

  Object.keys(data).forEach(repo => {
    const activity = data[repo];
    Object.keys(activity).forEach(activityType => {
      process(repo, activity[activityType], activityType)
    });
  });

  return results;
}

/***/ }),

/***/ 616:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const UserActivityAttributes = __nccwpck_require__(662);

module.exports = class UserActivity {

    constructor(login) {
        this._login = login;

        const data = {};
        Object.values(UserActivityAttributes).forEach(type => {
            data[type] = {};
        });
        this._data = data;
    }

    get login() {
        return this._login;
    }

    get email() {
        return this._email || '';
    }

    set email(email) {
        this._email = email;
    }

    get name() {
        return this._name || '';
    }

    set name(name) {
        this._name = name;
    }

    get url() {
        return this._url || '';
    }

    set url(url) {
        this._url = url;
    }

    get isActive() {
        return (this.commits + this.pullRequestComments + this.issueComments + this.issues) > 0;
    }

    increment(attribute, repo, amount) {
        if (Object.values(UserActivityAttributes).indexOf(attribute) > -1) {
            if (!this._data[attribute][repo]) {
                this._data[attribute][repo] = 0
            }
            this._data[attribute][repo] = this._data[attribute][repo] + amount;
        } else {
            throw new Error(`Unsupported attribute type '${attribute}'`);
        }
    }

    get commits() {
        return this._getTotal(UserActivityAttributes.COMMITS);
    }

    get pullRequestComments() {
        return this._getTotal(UserActivityAttributes.PULL_REQUEST_COMMENTS);
    }

    get issues() {
        return this._getTotal(UserActivityAttributes.ISSUES);
    }

    get issueComments() {
        return this._getTotal(UserActivityAttributes.ISSUE_COMMENTS);
    }

    get jsonPayload() {
        const self = this,
            result = {
                login: this.login,
                email: this.email,
                name: this.name,
                url: this.url,
                isActive: this.isActive
            };

        Object.values(UserActivityAttributes).forEach(type => {
            result[type] = self._getTotal(type);
        })

        return result;
    }

    _getTotal(attribute) {
        let total = 0;

        if (this._data[attribute]) {
            const values = this._data[attribute];

            Object.keys(values).forEach(repo => {
                total += values[repo];
            });
        }

        return total;
    }
}

/***/ }),

/***/ 662:
/***/ ((module) => {


module.exports = {
  COMMITS: 'commits',
  ISSUES: 'issues',
  ISSUE_COMMENTS: 'issueComments',
  PULL_REQUEST_COMMENTS: 'prComments',
}

/***/ }),

/***/ 329:
/***/ ((module) => {

const DAY_IN_MS = 24 * 60 * 60 * 1000;

module.exports = {

  getFromDate: (since) => {
    return getISODate(since)
  },

  convertDaysToDate: (days) => {
    if (days > 0) {
      const offset = DAY_IN_MS * days;
      return getISODate(Date.now() - offset);
    } else {
      throw new Error(`Invalid number of days; ${days}, must be greater than zero`);
    }
  }
}

function getISODate(value) {
  if (!value) {
    throw new Error('A date value must be provided');
  }

  const date = new Date(value);
  clearTime(date);
  return date.toISOString();
}

function clearTime(date) {
  date.setHours(0);
  date.setMinutes(0);
  date.setSeconds(0);
  date.setMilliseconds(0);
}

/***/ }),

/***/ 571:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const util = __nccwpck_require__(329);

module.exports = class CommitActivity {

  constructor(octokit) {
    if (!octokit) {
      throw new Error('An octokit client must be provided');
    }
    this._octokit = octokit;
  }

  getCommitActivityFrom(owner, repo, since) {
    const from = util.getFromDate(since)
      , repoFullName = `${owner}/${repo}`
    ;

    return this.octokit.paginate('GET /repos/:owner/:repo/commits',
      {
        owner: owner,
        repo: repo,
        since: from,
        per_page: 100,
      }
    ).then(commits => {
      const committers = {};

      commits.forEach(commit => {
        if (commit.author && commit.author.login) {
          const login = commit.author.login;

          if (!committers[login]) {
            committers[login] = 1;
          } else {
            committers[login] = committers[login] + 1;
          }
        }
      });

      const result = {};
      result[repoFullName] = committers;

      return result;
    })
      .catch(err => {
        if (err.status === 404) {
          //TODO could log this out
          return {};
        } else if (err.status === 409) {
          if (err.message.toLowerCase().startsWith('git repository is empty')) {
            return {};
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      })
  }

  get octokit() {
    return this._octokit;
  }
}




/***/ }),

/***/ 820:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const util = __nccwpck_require__(329);

module.exports = class IssueActivity {

  constructor(octokit) {
    if (!octokit) {
      throw new Error('An octokit client must be provided');
    }
    this._octokit = octokit;
  }

  getIssueActivityFrom(owner, repo, since) {
    const from = util.getFromDate(since)
      , repoFullName = `${owner}/${repo}`
    ;

    return this.octokit.paginate('GET /repos/:owner/:repo/issues',
      {
        owner: owner,
        repo: repo,
        since: from,
        per_page: 100,
      }
    ).then(issues => {
      const users = {};

      issues.forEach(issue => {
        if (issue.user && issue.user.login) {
          const login = issue.user.login;

          if (!users[login]) {
            users[login] = 1;
          } else {
            users[login] = users[login] + 1;
          }
        }
      });

      const data = {}
      data[repoFullName] = users;
      return data;
    }).catch(err => {
      if (err.status === 404) {
        return {};
      } else {
        console.error(err)
        throw err;
      }
    });
  }

  getIssueCommentActivityFrom(owner, repo, since) {
    const from = util.getFromDate(since)
      , repoFullName = `${owner}/${repo}`
    ;

    return this.octokit.paginate('GET /repos/:owner/:repo/issues/comments',
      {
        owner: owner,
        repo: repo,
        since: from,
        per_page: 100,
      }
    ).then(comments => {
      const users = {};

      comments.forEach(comment => {
        if (comment.user && comment.user.login) {
          const login = comment.user.login;

          if (!users[login]) {
            users[login] = 1;
          } else {
            users[login] = users[login] + 1;
          }
        }
      });

      const data = {}
      data[repoFullName] = users;
      return data;
    }).catch(err => {
      if (err.status === 404) {
        //TODO could log this out
        return {};
      } else {
        console.error(err)
        throw err;
      }
    })
  }

  get octokit() {
    return this._octokit;
  }
}

/***/ }),

/***/ 615:
/***/ ((module) => {

module.exports = class Organization {

  constructor(octokit) {
    if (!octokit) {
      throw new Error('An octokit client must be provided');
    }
    this._octokit = octokit;
  }

  getRepositories(org) {
    return this.octokit.paginate("GET /orgs/:org/repos", { org: org, per_page: 100 })
      .then(repos => {
        console.log(`Processing ${repos.length} repositories`);
        return repos.map(repo => {
          return {
            name: repo.name,
            owner: org, //TODO verify this in not in the payload
            full_name: repo.full_name,
            has_issues: repo.has_issues,
            has_projects: repo.has_projects,
            url: repo.html_url,
            private: repo.private,
          }
        });
      });
  }

  async findUsers(org) {
    var octokitApi = this._octokit;

    var members = await this.octokit.paginate("GET /orgs/:org/members", { org: org, per_page: 100 });
    var users = members.map(m => {
      return octokitApi.users.getByUsername({
        username: m.login,
      }).then(u => {
        return {
          login: m.login,
          email: u.data.email || '',
          url: u.data.html_url,
          name: u.data.name,
        }
      });
    });
    var allUsers = await Promise.all(users).then(u => u);
    return allUsers;
  }

  get octokit() {
    return this._octokit;
  }
}

/***/ }),

/***/ 94:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const util = __nccwpck_require__(329);

module.exports = class PullRequestActivity {

  constructor(octokit) {
    if (!octokit) {
      throw new Error('An octokit client must be provided');
    }
    this._octokit = octokit;
  }

  getPullRequestCommentActivityFrom(owner, repo, since) {
    const from = util.getFromDate(since)
      , repoFullName = `${owner}/${repo}`
    ;

    return this.octokit.paginate('GET /repos/:owner/:repo/pulls/comments',
      {
        owner: owner,
        repo: repo,
        since: from,
        per_page: 100,
      }
    ).then(prComments => {
      const users = {};

      prComments.forEach(prComment => {
        if (prComment.user && prComment.user.login) {
          const login = prComment.user.login;

          if (!users[login]) {
            users[login] = 1;
          } else {
            users[login] = users[login] + 1;
          }
        }
      });

      const result = {};
      result[repoFullName] = users;

      return result;
    })
      .catch(err => {
        if (err.status === 404) {
          //TODO could log this out
          return {};
        } else {
          console.error(err)
          throw err;
        }
      })
  }

  get octokit() {
    return this._octokit;
  }
}




/***/ }),

/***/ 355:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const CommitActivity = __nccwpck_require__(571)
  , IssueActivity = __nccwpck_require__(820)
  , PullRequestActivity = __nccwpck_require__(94)
  , UserActivityAttributes = __nccwpck_require__(662)

module.exports = class RepositoryActivity {

  constructor(octokit) {
    this._commitActivity = new CommitActivity(octokit)
    this._issueActivity = new IssueActivity(octokit)
    this._pullRequestActivity = new PullRequestActivity(octokit)
  }

  async getActivity(repo, since) {
    const owner = repo.owner
      , name = repo.name
      , fullName = repo.full_name
      , commitActivity = this._commitActivity
      , issueActivity = this._issueActivity
      , prActivity = this._pullRequestActivity
      , data = {}
    ;

    //TODO need some validation around the parameters

    console.log(`Building repository activity for: ${fullName}...`);

    const commits = await commitActivity.getCommitActivityFrom(owner, name, since);
    data[UserActivityAttributes.COMMITS] = commits[fullName];

    const issues = await issueActivity.getIssueActivityFrom(owner, name, since)
    data[UserActivityAttributes.ISSUES] = issues[fullName];

    const issueComments = await issueActivity.getIssueCommentActivityFrom(owner, name, since);
    data[UserActivityAttributes.ISSUE_COMMENTS] = issueComments[fullName];

    const prComments = await prActivity.getPullRequestCommentActivityFrom(owner, name, since)
    data[UserActivityAttributes.PULL_REQUEST_COMMENTS] = prComments[fullName];

    const results = {};
    results[fullName] = data;

    console.log(`  completed.`);
    return results;

    // Need to avoid triggering the chain so using async now
    //
    // return commitActivity.getCommitActivityFrom(owner, name, since)
    //   .then(commits => {
    //     data[UserActivityAttributes.COMMITS] = commits[fullName];
    //     return issueActivity.getIssueActivityFrom(owner, name, since);
    //   })
    //   .then(issues => {
    //     data[UserActivityAttributes.ISSUES] = issues[fullName];
    //     return issueActivity.getIssueCommentActivityFrom(owner, name, since);
    //   })
    //   .then(issueComments => {
    //     data[UserActivityAttributes.ISSUE_COMMENTS] = issueComments[fullName];
    //     return prActivity.getPullRequestCommentActivityFrom(owner, name, since);
    //   })
    //   .then(prComments => {
    //     data[UserActivityAttributes.PULL_REQUEST_COMMENTS]= prComments[fullName];
    //
    //     const results = {}
    //     results[fullName] = data;
    //     return results;
    //   });
  }
}




/***/ }),

/***/ 843:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const {throttling} = __nccwpck_require__(462)
  , {retry} = __nccwpck_require__(228)
  , {Octokit} = __nccwpck_require__(243)
;

const RetryThrottlingOctokit = Octokit.plugin(throttling, retry);

//TODO could apply the API endpoint (i.e. support GHES)

module.exports.create = (token, maxRetries) => {
  const MAX_RETRIES = maxRetries ? maxRetries : 3

  const octokit =new RetryThrottlingOctokit({
    auth: `token ${token}`,

    throttle: {
      onRateLimit: (retryAfter, options) => {
        octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
        octokit.log.warn(`  request retries: ${options.request.retryCount}, MAX: ${MAX_RETRIES}`);

        if (options.request.retryCount < MAX_RETRIES) {
          octokit.log.warn(`Retrying after ${retryAfter} seconds.`);
          return true;
        }
      },

      onAbuseLimit: (retryAfter, options) => {
        octokit.log.warn(`Abuse detection triggered request ${options.method} ${options.url}`);
        // Prevent any further activity as abuse trigger has very long periods to come back from
        return false;
        // if (options.request.retryCount < MAX_RETRIES) {
        //   octokit.log.warn(`Retrying after ${retryAfter} seconds`);
        //   return true;
        // }
      }
    }
  });

  return octokit;
}



/***/ }),

/***/ 450:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 915:
/***/ ((module) => {

module.exports = eval("require")("@actions/io");


/***/ }),

/***/ 228:
/***/ ((module) => {

module.exports = eval("require")("@octokit/plugin-retry");


/***/ }),

/***/ 462:
/***/ ((module) => {

module.exports = eval("require")("@octokit/plugin-throttling");


/***/ }),

/***/ 243:
/***/ ((module) => {

module.exports = eval("require")("@octokit/rest");


/***/ }),

/***/ 82:
/***/ ((module) => {

module.exports = eval("require")("json2csv");


/***/ }),

/***/ 747:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ 622:
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
// const github = require('@actions/github')
//   , core = require('@actions/core')
const fs = __nccwpck_require__(747)
  , path = __nccwpck_require__(622)
  , core = __nccwpck_require__(450)
  , io = __nccwpck_require__(915)
  , json2csv = __nccwpck_require__(82)
  , OrganizationActivity = __nccwpck_require__(327)
  , githubClient = __nccwpck_require__(843)
  , dateUtil = __nccwpck_require__(329)
;

async function run() {
  const since = core.getInput('since')
    , days = core.getInput('activity_days')
    , token = getRequiredInput('token')
    , outputDir = getRequiredInput('outputDir')
    , organization = getRequiredInput('organization')
    , maxRetries = getRequiredInput('octokit_max_retries')
  ;

  let fromDate;
  if (since) {
    console.log(`Since Date has been specified, using that instead of active_days`)
    fromDate = dateUtil.getFromDate(since);
  } else {
    fromDate = dateUtil.convertDaysToDate(days);
  }

  // Ensure that the output directory exists before we our limited API usage
  await io.mkdirP(outputDir)

  const octokit = githubClient.create(token, maxRetries)
    , orgActivity = new OrganizationActivity(octokit)
  ;

  console.log(`Attempting to generate organization user activity data, this could take some time...`);
  const userActivity = await orgActivity.getUserActivity(organization, fromDate);
  saveIntermediateData(outputDir, userActivity.map(activity => activity.jsonPayload));

  // Convert the JavaScript objects into a JSON payload so it can be output
  console.log(`User activity data captured, generating report...`);
  const data = userActivity.map(activity => activity.jsonPayload)
    , csv = json2csv.parse(data, {})
  ;

  const file = path.join(outputDir, 'organization_user_activity.csv');
  fs.writeFileSync(file, csv);
  console.log(`User Activity Report Generated: ${file}`);

  // Expose the output csv file
  core.setOutput('report_csv', file);
}

async function execute() {
  try {
    await run();
  } catch (err) {
    core.setFailed(err.message);
  }
}
execute();


function getRequiredInput(name) {
  return core.getInput(name, {required: true});
}

function saveIntermediateData(directory, data) {
  try {
    const file = path.join(directory, 'organization_user_activity.json');
    fs.writeFileSync(file, JSON.stringify(data));
    core.setOutput('report_json', file);
  } catch (err) {
    console.error(`Failed to save intermediate data: ${err}`);
  }
}
})();

module.exports = __webpack_exports__;
/******/ })()
;