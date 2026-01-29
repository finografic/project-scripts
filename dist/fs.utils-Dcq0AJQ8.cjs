const require_chunk = require('./chunk-CbDLau6x.cjs');
let node_fs = require("node:fs");

//#region src/utils/fs.utils.ts
const isFile = (path) => {
	try {
		return (0, node_fs.statSync)(path).isFile();
	} catch {
		return false;
	}
};

//#endregion
Object.defineProperty(exports, 'isFile', {
  enumerable: true,
  get: function () {
    return isFile;
  }
});