#!/usr/bin/env node
const { program } = require('commander')
const { exec, execSync } = require('node:child_process')
const pkg = require('../package.json')
const registries = require('../registries.json')
const { select, input, confirm } = require('@inquirer/prompts')
const chalk = require('chalk')
const ping = require('node-http-ping')
const { writeFileSync } = require('node:fs')
const {resolve} = require('node:path')

program.version(pkg.version)

async function getOrigin () {
  return await execSync('npm get registry', { encoding: 'utf-8' }).trim()
}

function setCommond(registry) {
  return  `npm config set registry ${registry}`
}

 async function save({sucMsg, sucCallback, errCallback}){
  try{
    writeFileSync(resolve(__dirname, '../registries.json'), JSON.stringify(registries, null, 2), 'utf8')
    typeof sucCallback == 'function' ?  sucCallback() : console.log(chalk.green(sucMsg))
  }catch(err){
    typeof errCallback == 'function' && errCallback()
    console.log(err);
  }
 } 

 function genRegistry(key, url){
  key = key.trim()
  url = url.trim()
  let len = url.length
  url = url[len - 1] == '/' ? url.substr(0, len - 1) : url
  registries[key] = {
    home: url,
    registry: url + '/',
    ping: url,
  }
 }

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
    try{
      await execSync(setCommond(answer), null)
      console.log(chalk.green('切换成功'))
    }catch(err){
      console.log(chalk.red('切换失败'), err)
    }
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

program
  .command('ping')
  .description('测试镜像地址速度')
  .action(async () => {
    const choices = Object.entries(registries).map(([key, { ping }]) => {
      return {
        name: key,
        value: ping,
        description: ping,
      }
    })
    select.separator
    const url = await select({
      message: '请选择要测试的镜像:',
      choices,
    })
    ping(url)
      .then((time) => console.log(chalk.blue(`响应时长: ${time}ms`)))
      .catch(() => console.log(chalk.red('GG')))
  })

program
  .command('add')
  .description('新增镜像')
  .action(async () => {
    let key = await input({
      message: '请输入镜像名称',
      validate(answer) {
        if (!answer) {
          return `镜像名称不能为空`
        }
        const keys = Object.keys(registries)
        if (keys.includes(answer)) {
          return `镜像名称${answer}已存在`
        }
        return true
      },
    })
    let url = await input({
      message: '请输入镜像地址',
      validate(answer) {
        if (!answer) {
          return '镜像地址不能为空'
        }
        return true
      },
    })
    genRegistry(key, url)
    save({
      sucMsg: '新增镜像成功！',
      errCallback() {
        delete registries[key]
        console.log(chailk.red('新增镜像失败！'))
      },
    })
  })

  program
  .command('delete')
  .description('删除镜像')
  .action(async () => {
    const curorigin = await getOrigin()
    const choices = Object.entries(registries).map(([key, {registry}]) => ({
      name: key, 
      value: key, 
      description: registry,
      disabled: curorigin == registry && '(current use)'
    }))
    const key = await select({
      message:'请选择要删除的镜像',
      choices 
    })
    const confirmResult = await confirm({
      message:`请确认是否删除 ${chalk.red(key)}`,
      default: true
    })
    if (confirmResult){
      //拷贝一份副本，以便写入失败的时候不原
      let copy = JSON.parse(JSON.stringify(registries))
      delete registries[key]
      save({
        sucMsg: '删除镜像成功！',
        errCallback() {
          registries = JSON.parse(JSON.stringify(copy))
          console.log(chalk.red('删除镜像失败！'))
        }
      })
    }
  })


program
  .command('edit')
  .description('修改镜像')
  .action(async () => {
    const curOrigin = await getOrigin()
    const choices = Object.entries(registries).map(([key, { registry }]) => ({
      name: key,
      value: key,
      description: registry,
    }))
    let key = await select({
      message: '请选择要修改的镜像',
      choices,
    })
    let url = await input({
      message: '请输入镜像地址',
      default: registries[key].registry,
      validate(answer) {
        if (!answer) {
          return '镜像地址不能为空'
        }
        return true
      },
    })
    let confirmResult = await confirm({
      message: `请确认是否修改 ${chalk.blue(key)} 的镜像地址为 ${url}`,
      default: true,
    })
    if (confirmResult) {
      let rawRegistry = registries[key]
      genRegistry(key, url)
      save({
        async sucCallback() {
          if (curOrigin == rawRegistry){
            await execSync(setCommond(rawRegistry), null)
          }
          console.log(chalk.green('修改镜像成功！'))
        },
        errCallback() {
          genRegistry(key, rawRegistry)
          console.log(chailk.red('修改镜像失败！'))
        },
      })
    }
  })

program.parse(process.argv)
