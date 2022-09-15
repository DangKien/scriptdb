/** @format */

const { spawn } = require("child_process");
const path = require("path");
const cron = require("node-cron");
const dotenv = require("dotenv").config();
const fs = require("fs");
const request = require("request");
// Database name
const DB_NAME = process.env.DB_NAME;
// File name backup
const STORE_ORACLE = process.env.STORE_ORACLE;
//Uri
const DB_URI = process.env.MONGODB_URI;

// Scheduling the backup every 5 seconds (using node-cron)
try {
  cron.schedule("0 0 */2 * * *", () => {
    const date = new Date();
    const fileName = `${DB_NAME}-${date.getFullYear()}-${
      date.getMonth() + 1
    }-${date.getDate()}T${date.getHours()}.${date.getMinutes()}.${date.getSeconds()}Z`;
    backupMongoDB(fileName);
  });
} catch (error) {
  console.log(error);
}

function backupMongoDB(fileName) {
  try {
    const ARCHIVE_PATH = path.join(__dirname, "public", `${fileName}.gzip`);
    const child = spawn("mongodump", [
      `--uri="${DB_URI}"`,
      `--archive=${ARCHIVE_PATH}`,
      "--gzip",
      "--forceTableScan",
    ]);
    child.stdout.on("data", (data) => {
      console.log("stdout:\n", data);
    });
    child.stderr.on("data", (data) => {
      console.log("stderr:\n", Buffer.from(data).toString());
    });
    child.on("error", (error) => {
      console.log("error:\n", error);
    });
    child.on("exit", (code, signal) => {
      if (code) console.log("Process exit with code:", code);
      else if (signal) console.log("Process killed with signal:", signal);
      else {
        const readStream = fs.createReadStream(ARCHIVE_PATH);
        let chunks = [];
        readStream.on("data", (chunk) => chunks.push(chunk));
        readStream.on("end", () => {
          const data = Buffer.concat(chunks);
          const options = {
            method: "PUT",
            url: `${STORE_ORACLE}${fileName}.gzip`,
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Encoding": "gzip",
            },
            encoding: null,
            body: data,
          };
          var stats = fs.statSync(ARCHIVE_PATH);
          request(options, function (error, response) {
            if (error) throw new Error(error);
            fs.unlinkSync(ARCHIVE_PATH);
            console.log("Backup is successfully ✅");
          });
        });
      }
    });
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}
