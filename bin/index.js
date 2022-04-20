#! /usr/bin/env node

const path = (await import('path')).default;
const replace = (await import('replace-in-file')).default;
const chalk = (await import('chalk')).default;
const shell = (await import('shelljs')).default;
const _ = (await import('lodash')).default;
const spinners = (await import('cli-spinners')).default;
const ora = (await import('ora')).default;
// const inquirer = (await import('inquirer')).default;
// const figlet = (await import('figlet')).default;

const args = process.argv.slice(2);
const log = console.log;



shell.echo(`\n`);

const spinner = ora({
	symbol: '🚀',
	text: `Starting...`,
	discardStdin: false
}).start();



if(!shell.which('git')) 
{
	spinner.stopAndPersist({
		symbol: '💀',
		text: `${chalk.red(`Sorry, this script requires ${chalk.underline.bold(`git`)}. Please install before proceeding -> ${chalk.underline(`https://github.com/git-guides/install-git`)}`)}`
	});
	
	shell.echo(`\n`);
	shell.exit(1);
}

if(!shell.which('vercel')) 
{
	spinner.stopAndPersist({
		symbol: '💀',
		text: `${chalk.red(`Sorry, this script requires ${chalk.underline.bold(`vercel cli`)}. Please install before proceeding via `) + chalk.bgRed.white(`npm i -g vercel`)}`
	});
	
	shell.echo(`\n`);
	shell.exit(1);
}



let templateUrl = 'https://github.com/droplab/droplab-site-templates.git';
let destFolder = '.';
let projectName = 'my-project';

const cloneRepo = (dir,repo) => 
{
	return new Promise((resolve,reject) => 
	{
		shell.exec(`git clone ${repo} ${dir} -q`,
			(code, stdout, stderr) =>
			{
				if(code !== 0) 
				{
					reject(new Error('Git clone failed'));
					return;
				}

				resolve({ code,stdout,stderr });
			}
		);
	})
	.catch(err => 
	{
		shell.echo(`Error: ${err.message}`);
		shell.exit(1);
	});
}

const cloneEnvFile = (templateFile,outputFile,projectName) => 
{
	return new Promise((resolve,reject) => 
	{
		replace(
			{
				files: templateFile,
				from: '%%PROJECT-NAME%%',
				to: projectName,
			}, 
			(error,results) => 
			{
				setTimeout(() =>
				{
					if(error) 
					{
						reject(new Error(error));
						return;
					}

					shell.cp(templateFile,outputFile);
					shell.rm(`-f`,templateFile);

					resolve({ results });

				},3000);
			}
		);
	})
	.catch(err => 
	{
		shell.echo(`Error: ${err.message}`);
		shell.exit(1);
	});
}

const installDependencies = () => 
{
	return new Promise((resolve,reject) => 
	{
		shell.exec(`cd ${destFolder} && yarn install`, { silent:true },
			(code, stdout, stderr) =>
			{
				if(code !== 0) 
				{
					reject(new Error('Error occured while installing dependencies'))
					return
				}

				resolve({ code,stdout,stderr })
			}
		);
	})
	.catch(err => 
	{
		shell.echo(`Error: ${err.message}`)
		shell.exit(1)
	});
}


switch(args.length)
{
	case 1:

		let v = args[0];
		
		switch(true)
		{
			case v.indexOf('http') !== -1:

				templateUrl = v;

			break;
			default:

				destFolder = v;

			break;
		}


	break;
	case 2:

		let v1 = args[0];
		let v2 = args[1];
		
		templateUrl = v1;
		destFolder = v2;

	break;
}

projectName = _.kebabCase(path.basename(path.resolve(destFolder)));



try 
{
	spinner.color = 'green';
	spinner.text = `Scaffolding project from ${chalk.cyan.bold(templateUrl)} into ${chalk.magenta.bold(destFolder)}...`;

	const { code,stdout,stderr} = await cloneRepo(destFolder,templateUrl);

	if(code === 0)
	{
		shell.rm(`-rf`,`${destFolder}/.git`);
		shell.rm(`-rf`,`${destFolder}/.github`);

		// Setup env vars file
		//
			spinner.color = 'yellow';
			spinner.text = `${chalk.yellow(`Setting up ${chalk.bold(`.env.local`)} file...`)}`;

			await cloneEnvFile(
				`${destFolder}/env.local.temp`,
				`${destFolder}/.env.local`,
				projectName
			);
			
		// Install dependencies
		//
			spinner.color = 'cyan';
			spinner.text = `${chalk.cyan(`Installing dependencies...`)}`;

			const { code3,stdout3,stderr3 } = await installDependencies();

		spinner.stopAndPersist({
			symbol: '✨',
			text: `${chalk.bold(chalk.green(`Done! Let's Fucking Go! 🚀🚀`))}`
		})
	
		shell.echo(`\n`);
		process.exit(0);
	}
	else
	{
		spinner.stopAndPersist({
			symbol: '💀',
			text: `${chalk.red(stderr)}`
		});
		
		shell.echo(`\n`);
		shell.exit(1);
	}

}
catch(e)
{
	spinner.stopAndPersist({
		symbol: '💀',
		text: `${chalk.red(e)}`
	});
	
	shell.echo(`\n`);
	shell.exit(1);
}

process.exit(0);