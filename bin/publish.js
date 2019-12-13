#!/usr/bin/node

const chalk = require("chalk");
const fs = require('fs');
const im = require("imagemagick");
const path = require('path');
const readline = require("readline");
const tmp = require("tmp");

if (process.argv.length != 3) {
  process.stderr.write(`Usage:\n\t${chalk.bold.green(process.argv[1])} ${chalk.bold.yellow("image")}\n\n`);
  process.exit(1)
}

const images = process.argv.slice(2);
const tmpdir = tmp.dirSync();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

process.on("exit", _ => {
  tmpdir.removeCallback();
  rl.close();
});

makePost(tmpdir, images);

async function makePost(tmpdir, images) {
  const post = {
    date: new Date(),
    title: "",
    stringifiedTitle: "",
    postPath: "",
    description: "",
    image: null,
  };

  let postsPath = null;
  if (fs.existsSync("_posts")) {
    postsPath = "_posts";
  } else if (fs.existsSync("../_posts")) {
    postsPath = "../_posts";
  } else {
    process.stderr.write(chalk.bold("Unable to find the `_posts` directory\n"));
    process.exit(1);
  }

  let filesPath = null;
  if (fs.existsSync("files")) {
    filesPath = "files";
  } else if (fs.existsSync("../files")) {
    filesPath = "../files";
  } else {
    process.stderr.write(chalk.bold("Unable to find the `files` directory\n"));
    process.exit(1);
  }

  while (!post.title) {
    post.title = await new Promise(resolve => {
      rl.question(chalk.yellow("Title: "), answer => resolve(answer));
    });

    if (!post.title) {
      process.stdout.write(chalk.red("Title cannot be empty\n"));
    }
  }

  post.stringifiedTitle =
    post.date.getFullYear() + "-" +
    new Intl.DateTimeFormat("en-US", { month: "2-digit"}).format(post.date) + "-" +
    new Intl.DateTimeFormat("en-US", { day: "2-digit"}).format(post.date) + "-" +
    post.title.toLowerCase().replace(/ /gi, "_").replace(/[^\w\s]/gi, "").substr(0, 20);

  post.description = await new Promise(resolve => {
    rl.question(chalk.yellow("Description: "), answer => resolve(answer));
  });

  post.postPath = path.join(postsPath, post.stringifiedTitle + ".md");

  post.image = await processImage(tmpdir, filesPath, images[0], post.stringifiedTitle, 0);

  let oldestDate = post.image.date;

  let buffer =
    "---\n" +
    "layout: post\n" +
    "title: " + post.title + "\n" +
    "date: " + oldestDate.toISOString() + "\n" +
    "img: " + path.join("files", post.image.imageName) + "\n" +
    "description: " + post.description + "\n" +
    "---\n";

  process.stdout.write("\n");
  process.stdout.write(chalk.green("Post path: ") + post.postPath + "\n");
  process.stdout.write(chalk.green("Post content:\n"));
  process.stdout.write(buffer);
  process.stdout.write(chalk.green("Image name: ") + post.image.imageName + chalk.yellow(" - from: ") + post.image.imageSrcPath + chalk.yellow(" to: ") + post.image.imageDestPath + "\n");

  const proceed = await new Promise(resolve => {
    rl.question(chalk.yellow("Proceed? [Y/n] "), answer => resolve(answer));
  });

  if (proceed.length !== 0 && proceed[0] !== "Y" && proceed[0] !== "y") {
    process.stderr.write(chalk.red("Terminated\n"));
    process.exit(0);
  }

  await new Promise(resolve => {
    fs.writeFile(post.postPath, buffer, err => {
      if (err) {
        process.stderr.write(chalk.bold("Error writing post file: "));
        process.stderr.write(chalk.red.bold(post.postPath));
        process.stderr.write(`\n${err}\n`);
        process.exit(1);
      }

      resolve();
    });
  });

  await new Promise(resolve => {
    fs.copyFile(post.image.imageSrcPath, post.image.imageDestPath, err => {
      if (err) {
        process.stderr.write(chalk.bold("Error copying imagefile: "));
        process.stderr.write(chalk.red.bold(image.imageSrcPath));
        process.stderr.write(chalk.bold(" to "));
        process.stderr.write(chalk.red.bold(image.imageDestPath));
        process.stderr.write(`\n${err}\n`);
        process.exit(1);
      }

      resolve();
    });
  });

  process.stdout.write(chalk.bold.green("Operation completed!\n"));
  process.exit(0);
}

async function processImage(tmpdir, filesdir, image, title, id) {
  const data = {
    originalImage: image,
    imageSrcPath: "",
    imageDestPath: "",
    imageName: "",
    format: "",
    date: null,
  };

  await new Promise(resolve => {
    im.identify(image, (err, features) => {
      if (err) {
        process.stderr.write(chalk.bold("Error processing image: "));
        process.stderr.write(chalk.red.bold(image));
        process.stderr.write(`\n${err}\n`);
        process.exit(1);
      }

      const b = features.properties["exif:datetimeoriginal"].split(/\D/);
      data.date = new Date(b[0],b[1]-1,b[2],b[3],b[4],b[5]);
      data.format = features.format;
      resolve();
    });
  });

  data.imageName = title + "_" + id + "." + formatToExt(data.format);
  data.imageSrcPath = path.join(tmpdir.name, data.imageName);
  data.imageDestPath = path.join(filesdir, data.imageName);

  await new Promise(resolve => {
    im.convert([image, "-resize", "1280x999999", data.imageSrcPath],
      (err, stdout) => {
        if (err) {
          process.stderr.write(chalk.bold("Error processing image: "));
          process.stderr.write(chalk.red.bold(image));
          process.stderr.write(`\n${err}\n`);
          process.exit(1);
        }

        resolve();
      }
    );
  });

  return data;
}

function formatToExt(format) {
  switch (format) {
    case "JPEG":
      return "jpg";

    case "PNG":
      return "png";

    default:
      process.stderr.write(chalk.bold("Invalid image format: "))
      process.stderr.write(chalk.red.bold(format));
      process.stderr.write(`\n${err}\n`);
      process.exit(1);
  }
}
