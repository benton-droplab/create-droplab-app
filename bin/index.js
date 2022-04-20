#! /usr/bin/env node

const path = (await import('path')).default;
const chalk = (await import('chalk')).default;
const shell = (await import('shelljs')).default;
// const inquirer = (await import('inquirer')).default;
// const figlet = (await import('figlet')).default;

if(!shell.which('git')) 
{
	shell.echo(chalk.red(`\nSorry, this script requires ${chalk.underline(`git`)}. Please install before proceeding.\n`));
	shell.exit(1);
}

if(!shell.which('vercel')) 
{
	shell.echo(chalk.red(`\nSorry, this script requires the ${chalk.underline(`vercel cli`)}. Please install before proceeding via `) + chalk.bgRed.white(`npm i -g vercel`)+`\n`);
	shell.exit(1);
}

const log = console.log;

const args = process.argv.slice(2);

let templateUrl = 'https://github.com/droplab/droplab-site-templates.git';
let destFolder = '.';

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

try 
{
	shell.echo(`\n${chalk.green(`Scaffolding project from ${chalk.blue.bold(templateUrl)} into ${chalk.bold(destFolder)}...`)}`);
	
	const { code,stdout,stderr } = shell.exec(`git clone ${templateUrl} ${destFolder}`, { silent:true });

	if(code === 0)
	{
		shell.rm(`-rf`,`${destFolder}/.git`);
		shell.rm(`-rf`,`${destFolder}/.github`);
		
		const { code2,stdout2,stderr2 } = shell.exec(`vercel env pull development ${destFolder}/.env.local`, { silent:true });

		if(code2 !== 0)
		{
			shell.echo(`\n${chalk.yellow(`Unable to pull vercel environment vars... creating clean ${chalk.bold(`.env.local`)} file`)}`);
			
			shell.cp(`${destFolder}/env.local.temp`,`${destFolder}/.env.local`);
		}
		else
		{
			shell.echo(`\n${chalk.green(`Synchronized vercel environment vars to ${chalk.bold(`.env.local`)}`)}`);
		}

		shell.rm(`-f`,`${destFolder}/env.local.temp`);
		
		shell.echo(`\n${chalk.green(`[SUCCESS]`)}\n`);
	}
	else
	{
		shell.echo(`\n${chalk.red(`[ERROR] ${stderr}`)}\n`);
	}

}
catch(e)
{
	shell.echo(`\n${chalk.red('Ruh Roh... Something Went Wrong...')} ${e}\n`);
}

process.exit(0); //no errors occurred