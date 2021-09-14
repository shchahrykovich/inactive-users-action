// const github = require('@actions/github')
//   , core = require('@actions/core')
const fs = require('fs')
  , path = require('path')
  , core = require('@actions/core')
  , io = require('@actions/io')
  , json2csv = require('json2csv')
  , OrganizationActivity = require('./src/OrganizationUserActivity')
  , githubClient = require('./src/github/githubClient')
  , dateUtil = require('./src/dateUtil')
  , minimist = require('minimist')
;

var argv = minimist(process.argv.slice(2));

async function run() {
  const since = core.getInput('since') || argv.since
    , days = core.getInput('activity_days') || argv.activitydays
    , token = core.getInput('token') || argv.token || getRequiredInput('token')
    , outputDir =  core.getInput('outputDir') || argv.outputDir || getRequiredInput('outputDir')
    , organization = core.getInput('organization') || argv.organization || getRequiredInput('organization')
    , maxRetries = core.getInput('octokit_max_retries') || argv.retries || getRequiredInput('octokit_max_retries')
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

  const fileHtml = path.join(outputDir, 'organization_user_activity.html');
  
  var html = "<html><body><h3>User report for " + organization + "</h3><p></p><table>";
  html += "<tr>";
  html += "<th>Login</th>";
  html += "<th>Email</th>";
  html += "<th>Name</th>";
  html += "<th>Url</th>";
  html += "<th>is active</th>";
  html += "<th>commits</th>";
  html += "<th>issues</th>";
  html += "<th>issue comments</th>";
  html += "<th>pr comments</th>";
  html += "</tr>";

  for(var i in data) {
    var current = data[i];
    html += "<tr>";
    html += "<td>" + current.login + "</td>";
    html += "<td>" + current.email + "</td>";
    html += "<td>" + current.name + "</td>";
    html += "<td><a href='" + current.url + "'>" + current.url + "</a></td>";
    html += "<td>" + current.isActive + "</td>";
    html += "<td>" + current.commits + "</td>";
    html += "<td>" + current.issues + "</td>";
    html += "<td>" + current.issueComments + "</td>";
    html += "<td>" + current.prComments + "</td>";
    html += "</tr>";
  }
  html += "</table></body></html>";

  fs.writeFileSync(fileHtml, html);
  console.log(`User Activity Report Generated: ${fileHtml}`);

  // Expose the output csv file
  core.setOutput('report_html', fileHtml);
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