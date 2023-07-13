const { program } = require('commander')
const { exec, execSync } = require('node:child_process')
const pkg = require('../package.json')
const registries = require('../registries.json')
const { select } = require('@inquirer/prompts')
const chalk = require('chalk')

program.version(pkg.version)

const getOrigin = async () => await execSync('npm get registry', { encoding: 'utf-8' }).trim()

program
  .command('ls')
  .description('查看所有镜像配置')
  .action(async () => {
    const curOrigin = await getOrigin()
    const keys = Object.keys(registries)
    const maxKeyLength = Math.max(...keys.map((k) => k.length))
    const list = keys.reduce((arr, key) => {
      let { registry } = registries[key]
      let prefix = registry === curOrigin ? '* ' : '  '
      let separator = Array(maxKeyLength - key.length + 5)
        .fill('-')
        .join('')
      let str = prefix + key + ' ' + separator + ' ' + registry
      arr.push(str)
      return arr
    }, [])
    console.log(list.join('\n'))
  })

program
  .command('use')
  .description('使用镜像')
  .action(async () => {
    const choices = Object.entries(registries).map(([key, { registry }]) => {
      return {
        name: key,
        value: registry,
        description: registry,
      }
    })
    select.separator
    const answer = await select({
      message: '请选择镜像:',
      choices,
    })
    let command = `npm config set registry ${answer}`
    exec(command, null, (err, stdout, stderr) => {
      if (err) {
        console.log(chalk.red('切换错误'), err)
      } else {
        console.log(chalk.red('切换成功'))
      }
    })
  })

program
  .command('current')
  .description('查看当前镜像')
  .action(async () => {
    const curOrigin = await getOrigin()
    const k = Object.keys(registries).find((k) => {
      return registries[k].registry == curOrigin
    })
    console.log(chalk.blue('当前源:'), k)
  })

program.parse()
