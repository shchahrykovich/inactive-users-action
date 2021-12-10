const semver = require('semver');
var getLatestTag = require('git-latest-tag');
const { exec } = require("child_process");

getLatestTag(true, function(err, currentTag) {
    console.log(`Current tag: ${currentTag}`)

    if (!semver.valid(currentTag)) {
        console.log('version is not valid');
        return;
    }

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