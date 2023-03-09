#! /usr/bin/env node
import path from "path";
import fs from "node:fs";
import replace from "replace-in-file";
import chalk from "chalk";
import shell from "shelljs";
import _ from "lodash";
import ora from "ora";
import updateNotifier from "update-notifier";
import fetch from "node-fetch";
import { FormData } from "formdata-node";
import clipboardy from "clipboardy";
import { parseArgs } from "node:util";
import prompt from "prompt";
import pkg from "../package.json" assert { type: "json" };

updateNotifier({ pkg }).notify();

const authenticate = () => {
	return new Promise(async (resolve, reject) => {
		try {
			const form = new FormData();
			form.set("client_id", GITHUB_APP_ID);
			form.set("scope", GITHUB_APP_SCOPE);

			const res = await fetch("https://github.com/login/device/code", {
				method: "POST",
				headers: {
					Accept: "application/json",
				},
				body: form,
			});

			const json = await res.json();

			if (json?.user_code) {
				spinner.text = `Paste the following code in the window that opens: ${chalk.bold(
					json?.user_code
				)}`;

				await clipboardy.write(json?.user_code); // copy to clipboard

				// Give this some time on the screen to be read... and then open login window
				//
				setTimeout(() => {
					shell.exec(`open https://github.com/login/device`);
				}, 3000);

				const form2 = new FormData();
				form2.set("client_id", GITHUB_APP_ID);
				form2.set("device_code", json?.device_code);
				form2.set("grant_type", GITHUB_APP_GRANT_TYPE);

				// poll for user auth response...
				//
				let loops = 0;
				let interval = parseInt(json?.interval);
				let timer;

				const checkAuth = async () => {
					loops++;

					if (loops >= 90) {
						reject(`Authentication timed out`);
						return;
					}

					const res2 = await fetch(
						"https://github.com/login/oauth/access_token",
						{
							method: "POST",
							headers: {
								Accept: "application/json",
							},
							body: form2,
						}
					);

					const json2 = await res2.json();

					//console.log(json2);

					if (json2?.access_token) {
						clearTimeout(timer);

						spinner.color = "green";
						spinner.text = `Authenticated!`;

						resolve({
							json: json2,
							access_token: json2?.access_token,
						});
					} else {
						if (json2?.access_denied) {
							spinner.color = "red";
							spinner.text = `User denied authentication`;

							reject(err);
						} else {
							if (json2?.authorization_pending) {
								spinner.color = "yellow";
								spinner.text = `Waiting for user to authenticate...`;
							}

							if (json2?.interval)
								interval = parseInt(json2?.interval);

							timer = setTimeout(checkAuth, interval * 1000);
						}
					}
				};

				timer = setTimeout(checkAuth, interval * 1000);
			}
		} catch (err) {
			//console.log('ERROR',err);
			reject(err);
		}
	});
};

const cloneRepo = (dir, repo) => {
	return new Promise((resolve, reject) => {
		shell.exec(
			`git clone ${repo} ${dir} -q`,
			{ silent: true },
			(code, stdout, stderr) => {
				if (code !== 0) {
					reject(new Error(stderr));
					return;
				}

				resolve({ code, stdout, stderr });
			}
		);
	}).catch((err) => {
		shell.echo(`\n\n` + chalk.red(`💀 ${err.message}\n`));
		shell.exit(1);
	});
};

const cloneEnvFile = (templateFile, outputFile, projectName) => {
	return new Promise((resolve, reject) => {
		replace(
			{
				files: templateFile,
				from: "%%PROJECT-NAME%%",
				to: projectName,
			},
			(error, results) => {
				// Give this some time on the screen to be read...
				//
				setTimeout(() => {
					if (error) {
						reject(new Error(error));
						return;
					}

					shell.cp(templateFile, outputFile);
					shell.rm(`-f`, templateFile);

					resolve({ results });
				}, 3000);
			}
		);
	}).catch((err) => {
		shell.echo(`\n\n` + chalk.red(`💀 ${err.message}\n`));
		shell.exit(1);
	});
};

const installDependencies = (destFolder) => {
	return new Promise((resolve, reject) => {
		shell.exec(
			`cd ${destFolder} && yarn install`,
			{ silent: true },
			(code, stdout, stderr) => {
				if (code !== 0) {
					reject(
						new Error("Error occured while installing dependencies")
					);
					return;
				}

				resolve({ code, stdout, stderr });
			}
		);
	}).catch((err) => {
		shell.echo(`\n\n` + chalk.red(`💀 ${err.message}\n`));
		shell.exit(1);
	});
};

function help() {
	shell.echo(`\n`);
	console.log(`Usage: droplab [options?] [project-name?]
Options:
	-h, --help		output usage information
	-l, --lang		add a language to the project (default: en)   
`);
	process.exit(0);
}

function checkDeps() {
	if (!shell.which("git")) {
		spinner.stopAndPersist({
			symbol: "💀",
			text: `${chalk.red(
				`Sorry, this script requires ${chalk.underline.bold(
					`git`
				)}. Please install before proceeding -> ${chalk.underline(
					`https://github.com/git-guides/install-git`
				)}`
			)}`,
		});

		shell.echo(`\n`);
		shell.exit(1);
	}

	if (!shell.which("vercel")) {
		spinner.stopAndPersist({
			symbol: "💀",
			text: `${
				chalk.red(
					`Sorry, this script requires ${chalk.underline.bold(
						`vercel cli`
					)}. Please install before proceeding via `
				) + chalk.bgRed.white(`npm i -g vercel`)
			}`,
		});

		shell.echo(`\n`);
		shell.exit(1);
	}
}

async function getProjectName(projectName) {
	if (!projectName) {
		spinner.stop();
		prompt.message = "";
		prompt.start();
		const _projectName = await prompt.get({
			properties: {
				projectName: {
					description: chalk.green("Choose a project name"),
					required: true,
				},
			},
		});
		// TODO: Add check for existing project directory
		if (fs.readdirSync(process.cwd()).includes(_projectName.projectName)) {
			console.log(chalk.red(`Project directory already exists!`));
			return await getProjectName();
		}
		return _projectName.projectName;
	} else {
		return projectName;
	}
}

async function checkLegacy(legacy) {
	if (typeof legacy === "undefined") {
		spinner.stop();
		prompt.message = "";
		prompt.start();
		const _legacy = await prompt.get({
			properties: {
				legacy: {
					description: chalk.green("Use legacy template? (y/n)"),
					required: true,
					pattern: /^(y|n)$/,
				},
			},
		});
		shell.echo(`\n`);
		spinner.start();
		return _legacy.legacy === "y" ? true : false;
	} else {
		return legacy;
	}
}

async function handleLegacy(legacy, dir) {
	if (legacy) {
		fs.rmdirSync(dir + "/src/app", { recursive: true });
		const config = fs.readFileSync(dir + "/next.config.js", "utf8");
		const editedConfig = config.replace("appDir: true", "appDir: false");
		fs.writeFileSync(dir + "/next.config.js", editedConfig);
	} else {
		fs.rmdirSync(dir + "/src/pages", { recursive: true });
		fs.rmdirSync(dir + "/src/legacy", { recursive: true });
		const config = fs.readFileSync(dir + "/next.config.js", "utf8");
		const editedConfig = config.replace("appDir: false", "appDir: true");
		fs.writeFileSync(dir + "/next.config.js", editedConfig);
	}
}

async function addLanguages(langs, dir){
	fs.rmSync(dir + "/src/lang/es.ts");
	const file = fs.readFileSync(dir + "/env/languages.ts", "utf8");
	const langsArray = langs.map(lang => lang.toLowerCase());
	const langCode = langsArray.reduce((acc, lang) => {
		fs.writeFileSync(dir + `/src/lang/${lang}.ts`, `import en from './en';

const ${lang}: typeof en = {}

export default ${lang};`);
		return acc + `\n	${lang}: () => import('@lang/${lang}').then((m) => m.default),`
	}	, "")
	const edited = file.replace("es: () => import('@lang/es').then((m) => m.default),", langCode);
	fs.writeFileSync(dir + "/env/languages.ts", edited);
}

let spinner = ora({
	symbol: "🚀",
	text: `Starting...`,
	discardStdin: false,
});

const GITHUB_APP_ID = "22887034ed1606286613";
const GITHUB_APP_SCOPE = "repo";
const GITHUB_APP_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

let username = "git";

async function main() {
	checkDeps();

	const args = parseArgs({
		options: {
			help: {
				type: "boolean",
				short: "h",
			},
			lang: {
				type: "string",
				short: "l",
				multiple: true,
			}
		},
		allowPositionals: true,
	});

	if (args.values.help) {
		help();
	}

	shell.echo(`\n`);

	const name = await getProjectName(args.positionals[0]);
	const useLegacy = await checkLegacy(args.values.legacy);

	spinner.start();

	const { access_token } = await authenticate();

	let templateUrl = `https://${username ? `${username}` : ""}${
		access_token ? `:${access_token}@` : `@`
	}github.com/benton-droplab/droplab13.git`;

	const projectName = _.kebabCase(name);
	const destFolder = name === "." ? "." : `./${name}`;

	spinner.color = "green";
	spinner.text = `Scaffolding template into ${chalk.magenta.bold(
		destFolder
	)}...`;

	const { code, stderr } = await cloneRepo(destFolder, templateUrl);

	if (code !== 0) {
		spinner.stopAndPersist({
			symbol: "💀",
			text: `${chalk.red(stderr)}`,
		});
		shell.exit(1);
	}

	// Remove git files
	shell.rm(`-rf`, `${destFolder}/.git`);
	shell.rm(`-rf`, `${destFolder}/.github`);

	// Setup env vars file
	spinner.color = "yellow";
	spinner.text = `${chalk.yellow(
		`Setting up ${chalk.bold(`.env.local`)} file...`
	)}`;
	await cloneEnvFile(
		`${destFolder}/env.local.temp`,
		`${destFolder}/.env.local`,
		projectName
	);

	// Install dependencies
	spinner.color = "cyan";
	spinner.text = `${chalk.cyan(`Installing dependencies...`)}`;
	await installDependencies(destFolder);

	// Add languages
	if(args.values.lang && !useLegacy){
		spinner.color = "cyan";
		spinner.text = `${chalk.cyan(`Adding languages...`)}`;
		await addLanguages(args.values.lang, destFolder);
		await new Promise((resolve) => setTimeout(resolve, 2000));
	} else if (useLegacy){
		fs.rmSync(destFolder + "/src/lang/es.ts");
		const code = fs.readFileSync(destFolder + "/env/languages.ts", "utf8");
		const edited = code.replace("es: () => import('@lang/es').then((m) => m.default),", "");
		fs.writeFileSync(destFolder + "/env/languages.ts", edited);
	}

	// Handle legacy
	spinner.color = "cyan";
	spinner.text = `${chalk.cyan(`Cleaning up...`)}`;

	await handleLegacy(useLegacy, destFolder);
	await new Promise((resolve) => setTimeout(resolve, 2000));

	spinner.stopAndPersist({
		symbol: "✨",
		text: `${chalk.bold(chalk.green(`Done! Let's Fucking Go! 🚀🚀`))}`,
	});
	process.exit(0);
}

await main();
