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