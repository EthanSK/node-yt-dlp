"use strict";

const { promisify } = require("util");
const stream = require("stream");
const mkdirp = require("mkdirp");
const path = require("path");
const util = require("util");
const got = require("got");
const fs = require("fs");
const os = require("os");

const ENDPOINT =
  process.env.YOUTUBE_DL_DOWNLOAD_HOST ||
  "https://youtube-dl-binary.vercel.app/";

const pipeline = promisify(stream.pipeline);

const [, , ...flags] = process.argv;

const isWin = flags.includes("--platform=windows") || require("./util").isWin;

const platform = os.platform();

let ytDlpFileUrl = (function () {
  if (platform === "win32") {
    return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
  } else if (platform === "darwin") {
    return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
  } else {
    return "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
  }
})();

const isOverwrite = flags.includes("--overwrite");

const getVersion = (str) =>
  /releases\/download\/(\d{4}\.\d\d\.\d\d(\.\d)?)\/youtube-dl/.exec(str)[1];

// First, look for the download link.
let dir;
let filePath;
const defaultBin = path.join(__dirname, "..", "bin");

function download(url, callback) {
  Promise.resolve() //coz i cba
    .then(async () => {
      const binaryUrl = ytDlpFileUrl;

      await pipeline(
        got.stream(binaryUrl),
        fs.createWriteStream(filePath, { mode: 493 })
      );

      return binaryUrl;
    })
    .then((binaryUrl) => callback(null))
    .catch(callback);
}

const exec = (path) => (isWin ? path + ".exe" : path);

function createBase(binDir) {
  dir = binDir || defaultBin;
  if (!fs.existsSync(dir)) {
    mkdirp.sync(dir);
    if (binDir) mkdirp.sync(defaultBin);
  }
  filePath = path.join(dir, exec("youtube-dl"));
}

function downloader(binDir, callback) {
  if (typeof binDir === "function") {
    callback = binDir;
    binDir = null;
  } else if (!callback) {
    return util.promisify(downloader)(binDir);
  }

  createBase(binDir);

  // handle overwritin
  if (fs.existsSync(filePath)) {
    if (!isOverwrite) {
      return callback(new Error("File exists"));
    }

    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      callback(e);
    }
  }

  download(
    `${ENDPOINT}?platform=${isWin ? "windows" : "linux"}`,
    function error(err) {
      if (err) return callback(err);
      return callback(null, "Downloaded youtube-dl ");
    }
  );
}

async function getAssetByFileName(owner, repo, filename) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases`;
    const response = await got(url);
    const releases = JSON.parse(response.body);

    for (const release of releases) {
      const asset = release.assets.find((asset) => asset.name === filename);

      if (asset) {
        console.log(`Found in release ${release.tag_name}`);
        console.log(asset);
        return;
      }
    }

    console.log(`No asset found with name ${filename}`);
  } catch (error) {
    console.error(error.response.body);
  }
}

module.exports = downloader;
