/** @format */

const { spawn } = require("child_process");
const path = require("path");
const cron = require("node-cron");
const dotenv = require("dotenv").config();
const fs = require("fs");
const request = require("request");

/*
Basic mongo dump and restore commands, they contain more options you can have a look at man page for both of them.
1. mongodump --db=rbac_tutorial --archive=./rbac.gzip --gzip
2. mongorestore --uri="mongodb://maeda:uzMSUJR4pChmNvVtypSZsFWapmTfLqeR@dev.maeda.just.engineer:27017,dev.maeda.just.engineer:27018,dev.maeda.just.engineer:27019/dev_maedaexpress?replicaSet=rs0&authSource=admin&authMechanism=SCRAM-SHA-1" --archive=/root/scriptdb/public/dev.maedaexpress.com.gzip --gzip

Using mongodump - without any args:
  will dump each and every db into a folder called "dump" in the directory from where it was executed.
Using mongorestore - without any args:
  will try to restore every database from "dump" folder in current directory, if "dump" folder does not exist then it will simply fail.
*/
const DB_NAME = "t_shirt";
const date = new Date();
const fileName = `${DB_NAME}-${date.getFullYear()}-${
  date.getMonth() + 1
}-${date.getDay()}T${date.getHours()}.${date.getMinutes()}.${date.getSeconds()}Z`;

const ARCHIVE_PATH = path.join(__dirname, "public", `${fileName}.gzip`);
const STORE_ORACLE = process.env.STORE_ORACLE;
console.log("🚀 ~ STORE_ORACLE", STORE_ORACLE);

// const ARCHIVE_PATH = path.join(
//   __dirname,
//   "public",
//   `${process.env.DB_NAME || "dev.maedaexpress.com"}.gzip`
// );

// 1. Cron expression for every 5 seconds - */5 * * * * *
// 2. Cron expression for every night at 00:00 hours (0 0 * * * )
// Note: 2nd expression only contains 5 fields, since seconds is not necessary

// Scheduling the backup every 5 seconds (using node-cron)
cron.schedule("*/200 * * * * *", () => backupMongoDB());

function backupMongoDB() {
  // const child = spawn("mongodump", [
  //   `--uri=${process.env.DB_URI}`,
  //   `--archive=${ARCHIVE_PATH}`,
  //   "--gzip",
  //   "--forceTableScan",
  // ]);

  const child = spawn("mongodump", [
    `--db=${DB_NAME}`,
    `--archive=${ARCHIVE_PATH}`,
    "--gzip",
    "--forceTableScan",
  ]);

  child.stdout.on("data", (data) => {
    console.log("stdout:\n", data);
  });
  child.stderr.on("data", (data) => {
    const fileContent = Buffer.from(data, "binary");
    request(
      {
        url: `${STORE_ORACLE}${fileName}`,
        method: "PUT",
        headers: {
          "cache-control": "no-cache",
        },
        encoding: null,
        body: fs.createReadStream(ARCHIVE_PATH),
      },
      (error, response, body) => {
        if (error) {
          console.log("error", error);
        } else {
          console.log("res", response.body.toString());
        }
      }
    );
  });
  child.on("error", (error) => {
    console.log("error:\n", error);
  });
  child.on("exit", (code, signal) => {
    if (code) console.log("Process exit with code:", code);
    else if (signal) console.log("Process killed with signal:", signal);
    else {
      console.log("Backup is successfull ✅");
    }
  });
}
