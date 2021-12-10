const semver = require('semver');
var getLatestTag = require('git-latest-tag');
const { execSync } = require("child_process");

getLatestTag(true, function(err, currentTag) {
    console.log(`Current tag: ${currentTag}`)

    if (!semver.valid(currentTag)) {
        console.log('version is not valid');
        return;
    }

    let nextTag = semver.inc(currentTag, 'minor');
    var attempts = 10;
    do {
        try {
            console.log(`Next tag: ${nextTag}`)
            execSync("git tag " + nextTag);
            return;
        } catch (e) {

        }
        nextTag = semver.inc(nextTag, 'minor');
        attempts--;
    } while (0 < attempts);
});