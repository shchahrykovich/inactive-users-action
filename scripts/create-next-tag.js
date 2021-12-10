const semver = require('semver');
var getLatestTag = require('git-latest-tag');
const { exec } = require("child_process");

var options = {
    all: 'ok',
    contains: true,
    candidates: 10,
    'commit-ish': 'HEAD'
};

getLatestTag(options, function(err, tag) {
    var currentTag = tag.replace('tags/', '');
    console.log(`Current tag: ${currentTag}`)

    const nextTag = semver.inc(currentTag, 'minor');
    console.log(`Next tag: ${nextTag}`)

    exec("git tag " + nextTag, (error, stdout, stderr) => {
        if (error) {
            console.log(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });
});