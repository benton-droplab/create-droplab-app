#! /usr/bin/env node

const path = (await import('path')).default;
const replace = (await import('replace-in-file')).default;
const chalk = (await import('chalk')).default;
const shell = (await import('shelljs')).default;
const _ = (await import('lodash')).default;
const spinners = (await import('cli-spinners')).default;
const ora = (await import('ora')).default;
const updateNotifier = (await import('update-notifier')).default;
const fetch = (await import('node-fetch')).default;
const { FormData } = (await import('formdata-node'));

const { createRequire } = (await import('module'));
const require = createRequire(import.meta.url);
const { stubObject } = require('lodash');
const pkg = require('../package.json');

// const inquirer = (await import('inquirer')).default;
// const figlet = (await import('figlet')).default;

const args = process.argv.slice(2);
const log = console.log;

updateNotifier({ pkg }).notify();



shell.echo(`\n`);

const spinner = ora({
	symbol: '🚀',
	text: `Starting...`,
	discardStdin: false
}).start();



const authenticate = () =>
{
	return new Promise(async (resolve,reject) =>
	{
		const form = new FormData();
		form.set('client_id', '22887034ed1606286613');
		form.set('scope', 'user,repo'); //repo');

		let res;
		
		try 
		{
			res = await fetch(
				'https://github.com/login/device/code', 
				{ 
					method:'POST',
					headers: 
					{
						//'Content-Type': 'application/json',
						'Accept': 'application/json'
					},
					body: form
				}
			)

			const json = await res.json();

			if(json?.user_code)
			{
				spinner.text = `Enter the following user code: ${chalk.bold(json?.user_code)}`;
				
				const form2 = new FormData();
				form2.set('client_id', '22887034ed1606286613');
				form2.set('device_code', json?.device_code);
				form2.set('grant_type','urn:ietf:params:oauth:grant-type:device_code')
		
				timer = setInterval(async () =>
				{
					const res2 = await fetch(
						'https://github.com/login/oauth/access_token',
						{
							method:'POST',
							headers: 
							{
								//'Content-Type': 'application/json',
								'Accept': 'application/json'
							},
							body: form2
						}
					);

					const json2 = await res2.json();

					if(json2?.access_token)
					{
						resolve({ json:json2, access_token: json2?.access_token });
					}

				},5000);
			}

			shell.exec(`open https://github.com/login/device`);
		}
		catch(err)
		{
			//console.log('ERROR',err);
			reject(err)	
		}
	})
}

const cloneRepo = (dir,repo) => 
{
	return new Promise((resolve,reject) => 
	{
		shell.exec(`git clone ${repo} ${dir} -q`,
			{ silent:true },
			(code, stdout, stderr) =>
			{
				if(code !== 0) 
				{
					reject(new Error(stderr));
					return;
				}

				resolve({ code,stdout,stderr });
			}
		);
	})
	.catch(err => 
	{
		shell.echo(`\n\n` + chalk.red(`💀 ${err.message}\n`));
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
		shell.echo(`\n\n` + chalk.red(`💀 ${err.message}\n`));
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
		shell.echo(`\n\n` + chalk.red(`💀 ${err.message}\n`));
		shell.exit(1);
	});
}











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




let _args = []
let username = '';
let token = '';

// extract required userid from arguments
//
	if(args.length)
	{
		args.forEach((v,i) =>
		{
			if(v.indexOf('--user=') !== -1)
			{
				username = v.split('--user=')[1];
			}
			else if(v.indexOf('--token=') !== -1)
			{
				token = v.split('--token=')[1];
			}
			else if(v.indexOf('--password=') !== -1)
			{
				token = v.split('--password=')[1];
			}
			else
			{
				_args.push(v);
			}
		})
	}

	//if(username && !token) 
	if(!username)
	{
		spinner.stopAndPersist({
			symbol: '🔒',
			text: `${chalk.red(`Please add a ${chalk.bgRed.white(`--user=<my-github-user-id>`)} argument to specifiy which user to authenticate as...`)}`
		});
		
		shell.echo(`\n`);
		shell.exit(1);
	}


let timer;
const { json,access_token } = await authenticate();

if(timer)
	clearTimeout(timer);

	
let templateUrl = `https://${username ? `${username}` : ''}${access_token ? `:${access_token}@` : `@`}github.com/droplab/droplab-site-templates.git`;
let destFolder = '.';
let destFolderName = '';
let projectName = 'my-project';






switch(_args.length)
{
	case 1:

		let v = _args[0];
		
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

		
		let v1 = _args[0];
		let v2 = _args[1];
		
		templateUrl = v1;
		destFolder = v2;

	break;
}

destFolderName = path.basename(path.resolve(destFolder));
projectName = _.kebabCase(destFolderName);


try 
{
	
	spinner.color = 'green';
	spinner.text = `Scaffolding template into ${chalk.magenta.bold(destFolder === '.' ? `./${destFolderName}` : destFolder)}...`;

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