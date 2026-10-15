const withPortraitLock = require('./plugin/withPortraitLock.cjs')
const withViewControllerStatusBar = require('./plugin/withViewControllerStatusBar.cjs')

// "plugins": ["@tastic/core"]: the OS stays in portrait (this package draws every turn) and each screen sets
// the status bar (so it can hide while the content is turned). Options go to withPortraitLock.
module.exports = (config, options) => withViewControllerStatusBar(withPortraitLock(config, options))
