/*
V2P同步变量到青龙

一键导出V2P的变量到青龙，支持正则匹配
需要用到的变量：qlParam和qlWhiteList

变量qlParam，在V2P里面添加，格式：
host=127.0.0.1:5700&client_id=xxxxxx&client_secret=yyyyyyyyyyyyyyyyyy
其中host是你的青龙IP和端口，client_id和client_secret需要到 青龙->系统设置->应用设置 里面添加，需要添加环境变量权限

需要同步的时候，运行下这个脚本即可
[MITM]
h5.ele.me

[rewrite_local]
^https:\/\/h5\.ele\.me\/ url script-request-header https://raw.githubusercontent.com/yelc66/98MagnetDownload/main/V2P_Sync_elm_QL.js

打开 APP, 访问下`我的`>`吃货豆查看详情
系统提示: `获取Cookie: 成功并且同步到青龙`
*/

const jsname = 'V2P获取饿了么CK同步到青龙'
const $ = new Env(jsname)
const logDebug = 0 //1为打印所有返回，0为不打印
const notifyFlag = 1 //0为关闭通知，1为打开通知,默认为1
let notifyStr = ''
let httpResult //global buffer
let qlParam = $.getdata('qlParam')
let qlWhiteList = 'elmck'
let qlHost = ''
let qlSecret = ''
let qlAuth = ''
let qlEnv = []

!(async () => {
  if (false) {
    return
  } else {
    let qlParamJson = populateParam(qlParam)
    if (
      !qlParamJson.host ||
      !qlParamJson.client_id ||
      !qlParamJson.client_secret
    ) {
      console.log('qlParam格式错误，请检查')
      return
    }
    if (!qlWhiteList) {
      console.log(
        '未填写要导出的变量名，如果要导出所有变量，设置qlWhiteList为.*'
      )
      return
    }
    qlHost = qlParamJson.host
    qlSecret =
      'client_id=' +
      qlParamJson.client_id +
      '&client_secret=' +
      qlParamJson.client_secret
    await GetRewrite()
  }
})()
  .catch((e) => $.logErr(e))
  .finally(() => $.done())

// 字符串转对象
function populateParam(param) {
  let ret = {}
  for (let item of param.split('&')) {
    let kv = item.split('=')
    if (kv.length == 2) {
      ret[kv[0]] = kv[1]
    }
  }
  return ret
}

async function GetRewrite() {
  if ($request.headers) {
   let cookie = $request.headers.cookie ? $request.headers.cookie : $request.headers.Cookie
    console.log(cookie)
//     if (cookie.indexOf('SID=') == -1 || cookie.indexOf('cookie2=') == -1) return
    let SID = cookie.match(/(SID=.+?;)/)[1]
    let cookie2 = cookie.match(/(cookie2=.+?;)/)[1]
    let userId = cookie.match(/(USERID=.+?;)/)[1]
    let ck = SID + cookie2 + userId
    console.log(`获取到${ck}的饿了么ck`)
    await getToken()
    if (!qlAuth) return
    await $.wait(100)
    await searchEnv(qlWhiteList)
    let isFound = false
    for (let item of qlEnv) {
      if (item.name == qlWhiteList && item.value.indexOf(userId) > -1) {
        await $.wait(100)
        await updateEnv(qlWhiteList,ck,item.remarks,item.id)
        await $.wait(100)
        await enableEnv(item.id, qlWhiteList)
        isFound = true
        break
      }
    }
    if (!isFound) {
      await $.wait(100)
      await addEnv(qlWhiteList, ck, `V2P_新增时间@${new Date().getTime()}`)
    }
  }
}

async function getToken() {
  let url = `http://${qlHost}/open/auth/token?${qlSecret}`
  let body = ``
  let urlObject = populateUrlObject(url, qlAuth, body)
  await httpRequest('get', urlObject)
  let result = httpResult
  if (!result) return
  //console.log(result)
  if (result.code == 200) {
    qlAuth = result.data.token
    console.log(`查询青龙接口成功`)
  } else {
    console.log(`查询青龙接口失败: ${result.message}`)
  }
}

async function searchEnv(keyword = '') {
  let url = `http://${qlHost}/open/envs?searchValue=${keyword}`
  let body = ``
  let urlObject = populateUrlObject(url, qlAuth, body)
  await httpRequest('get', urlObject)
  let result = httpResult
  if (!result) return
  if (result.code == 200) {
    qlEnv = result.data
    console.log(`获取青龙环境变量成功`)
  } else {
    console.log(`获取青龙环境变量失败: ${result.message}`)
  }
}

async function addEnv(name, value, remarks) {
  let param = { value, name, remarks }
  let url = `http://${qlHost}/open/envs`
  let body = JSON.stringify([param])
  let urlObject = populateUrlObject(url, qlAuth, body)
  await httpRequest('post', urlObject)
  let result = httpResult
  if (!result) return
  //console.log(result)
  if (result.code == 200) {
    console.log(`添加青龙环境变量${name}成功`)
    msg(`新增青龙环境变量${name}成功`, value)
    $.setdata(name,value)
  } else {
    console.log(`添加青龙环境变量${name}失败: ${result.message}`)
    msg(`新增青龙环境变量${name}失败: ${result.message}`)
  }
}

async function updateEnv(name, value, remarks, id) {
  let param = { value, name, remarks, id }
  let url = `http://${qlHost}/open/envs`
  let body = JSON.stringify(param)
  let urlObject = populateUrlObject(url, qlAuth, body)
  console.log(urlObject)
  await httpRequest('put', urlObject)
  let result = httpResult
  if (!result) return
  //console.log(result)
  if (result.code == 200) {
    console.log(`更新青龙环境变量${name}成功`)
    msg(`更新青龙环境变量${name}成功`, value)
    $.setdata(value,name)
  } else {
    console.log(`更新青龙环境变量${name}失败: ${result.message}`)
    msg(`更新青龙环境变量${name}失败: ${result.message}`)
  }
}

async function enableEnv(id, name) {
  let url = `http://${qlHost}/open/envs/enable`
  let body = JSON.stringify([id])
  let urlObject = populateUrlObject(url, qlAuth, body)
  await httpRequest('put', urlObject)
  let result = httpResult
  if (!result) return
  //console.log(result)
  if (result.code == 200) {
    console.log(`启用青龙环境变量${name}成功`)
  } else {
    console.log(`启用青龙环境变量${name}失败: ${result.message}`)
  }
}

//通知
const msg = (subtitle, cookie) => {
  $.msg($.name, subtitle,`ck值：${cookie}`)
  // if (msgType) return $message.success($.name, subtitle)
  // return $message.eroor($.name, subtitle)
}
function populateUrlObject(url, auth, body = '') {
  let host = url.replace('//', '/').split('/')[1]
  let urlObject = {
    url: url,
    headers: {
      Host: host,
      Accept: 'application/json',
    },
  }
  if (body) urlObject.body = body
  if (auth) urlObject.headers.Authorization = 'Bearer ' + auth
  return urlObject
}

async function httpRequest(method, url) {
  httpResult = null
  if (method == 'post' || method == 'put' || method == 'delete') {
    url.headers['Content-Type'] = 'application/json;charset=UTF-8'
    url.headers['Content-Length'] = url.body ? url.body.length : 0
  }
  return new Promise((resolve) => {
    $[method](url, async (err, resp, data) => {
      try {
        if (err) {
          console.log(`${method}请求失败`)
          if (safeGet(data)) {
            httpResult = JSON.parse(data)
            if (logDebug) console.log(httpResult)
          }
          console.log(JSON.stringify(err))
          $.logErr(err)
        } else {
          if (safeGet(data)) {
            httpResult = JSON.parse(data)
            if (logDebug) console.log(httpResult)
          }
        }
      } catch (e) {
        $.logErr(e, resp)
      } finally {
        resolve()
      }
    })
  })
}

function safeGet(data) {
  try {
    if (typeof JSON.parse(data) == 'object') {
      return true
    } else {
      console.log(data)
    }
  } catch (e) {
    console.log(e)
    console.log(`服务器访问数据为空，请检查自身设备网络情况`)
    return false
  }
}

var Base64 = {
  _keyStr: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
  encode: function (e) {
    var t = ''
    var n, r, i, s, o, u, a
    var f = 0
    e = Base64._utf8_encode(e)
    while (f < e.length) {
      n = e.charCodeAt(f++)
      r = e.charCodeAt(f++)
      i = e.charCodeAt(f++)
      s = n >> 2
      o = ((n & 3) << 4) | (r >> 4)
      u = ((r & 15) << 2) | (i >> 6)
      a = i & 63
      if (isNaN(r)) {
        u = a = 64
      } else if (isNaN(i)) {
        a = 64
      }
      t =
        t +
        this._keyStr.charAt(s) +
        this._keyStr.charAt(o) +
        this._keyStr.charAt(u) +
        this._keyStr.charAt(a)
    }
    return t
  },
  decode: function (e) {
    var t = ''
    var n, r, i
    var s, o, u, a
    var f = 0
    e = e.replace(/[^A-Za-z0-9+/=]/g, '')
    while (f < e.length) {
      s = this._keyStr.indexOf(e.charAt(f++))
      o = this._keyStr.indexOf(e.charAt(f++))
      u = this._keyStr.indexOf(e.charAt(f++))
      a = this._keyStr.indexOf(e.charAt(f++))
      n = (s << 2) | (o >> 4)
      r = ((o & 15) << 4) | (u >> 2)
      i = ((u & 3) << 6) | a
      t = t + String.fromCharCode(n)
      if (u != 64) {
        t = t + String.fromCharCode(r)
      }
      if (a != 64) {
        t = t + String.fromCharCode(i)
      }
    }
    t = Base64._utf8_decode(t)
    return t
  },
  _utf8_encode: function (e) {
    e = e.replace(/rn/g, 'n')
    var t = ''
    for (var n = 0; n < e.length; n++) {
      var r = e.charCodeAt(n)
      if (r < 128) {
        t += String.fromCharCode(r)
      } else if (r > 127 && r < 2048) {
        t += String.fromCharCode((r >> 6) | 192)
        t += String.fromCharCode((r & 63) | 128)
      } else {
        t += String.fromCharCode((r >> 12) | 224)
        t += String.fromCharCode(((r >> 6) & 63) | 128)
        t += String.fromCharCode((r & 63) | 128)
      }
    }
    return t
  },
  _utf8_decode: function (e) {
    var t = ''
    var n = 0
    var r = (c1 = c2 = 0)
    while (n < e.length) {
      r = e.charCodeAt(n)
      if (r < 128) {
        t += String.fromCharCode(r)
        n++
      } else if (r > 191 && r < 224) {
        c2 = e.charCodeAt(n + 1)
        t += String.fromCharCode(((r & 31) << 6) | (c2 & 63))
        n += 2
      } else {
        c2 = e.charCodeAt(n + 1)
        c3 = e.charCodeAt(n + 2)
        t += String.fromCharCode(
          ((r & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63)
        )
        n += 3
      }
    }
    return t
  },
}

function Env(t, e) {
  'undefined' != typeof process &&
    JSON.stringify(process.env).indexOf('GITHUB') > -1 &&
    process.exit(0)
  class s {
    constructor(t) {
      this.env = t
    }
    send(t, e = 'GET') {
      t = 'string' == typeof t ? { url: t } : t
      let s = this.get
      return (
        'POST' === e && (s = this.post),
        'PUT' === e && (s = this.put),
        new Promise((e, i) => {
          s.call(this, t, (t, s, r) => {
            t ? i(t) : e(s)
          })
        })
      )
    }
    get(t) {
      return this.send.call(this.env, t)
    }
    post(t) {
      return this.send.call(this.env, t, 'POST')
    }
    put(t) {
      return this.send.call(this.env, t, 'PUT')
    }
    delete(t) {
      return this.send.call(this.env, t, 'DELETE')
    }
  }
  return new (class {
    constructor(t, e) {
      ;(this.name = t),
        (this.http = new s(this)),
        (this.data = null),
        (this.dataFile = 'box.dat'),
        (this.logs = []),
        (this.isMute = !1),
        (this.isNeedRewrite = !1),
        (this.logSeparator = '\n'),
        (this.startTime = new Date().getTime()),
        Object.assign(this, e),
        this.log('', `\ud83d\udd14${this.name}, \u5f00\u59cb!`)
    }
    isNode() {
      return 'undefined' != typeof module && !!module.exports
    }
    isQuanX() {
      return 'undefined' != typeof $task
    }
    isSurge() {
      return 'undefined' != typeof $httpClient && 'undefined' == typeof $loon
    }
    isLoon() {
      return 'undefined' != typeof $loon
    }
    toObj(t, e = null) {
      try {
        return JSON.parse(t)
      } catch {
        return e
      }
    }
    toStr(t, e = null) {
      try {
        return JSON.stringify(t)
      } catch {
        return e
      }
    }
    getjson(t, e) {
      let s = e
      const i = this.getdata(t)
      if (i)
        try {
          s = JSON.parse(this.getdata(t))
        } catch {}
      return s
    }
    setjson(t, e) {
      try {
        return this.setdata(JSON.stringify(t), e)
      } catch {
        return !1
      }
    }
    getScript(t) {
      return new Promise((e) => {
        this.get({ url: t }, (t, s, i) => e(i))
      })
    }
    runScript(t, e) {
      return new Promise((s) => {
        let i = this.getdata('@chavy_boxjs_userCfgs.httpapi')
        i = i ? i.replace(/\n/g, '').trim() : i
        let r = this.getdata('@chavy_boxjs_userCfgs.httpapi_timeout')
        ;(r = r ? 1 * r : 20), (r = e && e.timeout ? e.timeout : r)
        const [o, h] = i.split('@'),
          a = {
            url: `http://${h}/v1/scripting/evaluate`,
            body: { script_text: t, mock_type: 'cron', timeout: r },
            headers: { 'X-Key': o, Accept: '*/*' },
          }
        this.post(a, (t, e, i) => s(i))
      }).catch((t) => this.logErr(t))
    }
    loaddata() {
      if (!this.isNode()) return {}
      {
        ;(this.fs = this.fs ? this.fs : require('fs')),
          (this.path = this.path ? this.path : require('path'))
        const t = this.path.resolve(this.dataFile),
          e = this.path.resolve(process.cwd(), this.dataFile),
          s = this.fs.existsSync(t),
          i = !s && this.fs.existsSync(e)
        if (!s && !i) return {}
        {
          const i = s ? t : e
          try {
            return JSON.parse(this.fs.readFileSync(i))
          } catch (t) {
            return {}
          }
        }
      }
    }
    writedata() {
      if (this.isNode()) {
        ;(this.fs = this.fs ? this.fs : require('fs')),
          (this.path = this.path ? this.path : require('path'))
        const t = this.path.resolve(this.dataFile),
          e = this.path.resolve(process.cwd(), this.dataFile),
          s = this.fs.existsSync(t),
          i = !s && this.fs.existsSync(e),
          r = JSON.stringify(this.data)
        s
          ? this.fs.writeFileSync(t, r)
          : i
          ? this.fs.writeFileSync(e, r)
          : this.fs.writeFileSync(t, r)
      }
    }
    lodash_get(t, e, s) {
      const i = e.replace(/\[(\d+)\]/g, '.$1').split('.')
      let r = t
      for (const t of i) if (((r = Object(r)[t]), void 0 === r)) return s
      return r
    }
    lodash_set(t, e, s) {
      return Object(t) !== t
        ? t
        : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []),
          (e
            .slice(0, -1)
            .reduce(
              (t, s, i) =>
                Object(t[s]) === t[s]
                  ? t[s]
                  : (t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}),
              t
            )[e[e.length - 1]] = s),
          t)
    }
    getdata(t) {
      let e = this.getval(t)
      if (/^@/.test(t)) {
        const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t),
          r = s ? this.getval(s) : ''
        if (r)
          try {
            const t = JSON.parse(r)
            e = t ? this.lodash_get(t, i, '') : e
          } catch (t) {
            e = ''
          }
      }
      return e
    }
    setdata(t, e) {
      let s = !1
      if (/^@/.test(e)) {
        const [, i, r] = /^@(.*?)\.(.*?)$/.exec(e),
          o = this.getval(i),
          h = i ? ('null' === o ? null : o || '{}') : '{}'
        try {
          const e = JSON.parse(h)
          this.lodash_set(e, r, t), (s = this.setval(JSON.stringify(e), i))
        } catch (e) {
          const o = {}
          this.lodash_set(o, r, t), (s = this.setval(JSON.stringify(o), i))
        }
      }
      elses = this.setval(t, e)
      return s
    }
    getval(t) {
      return this.isSurge() || this.isLoon()
        ? $persistentStore.read(t)
        : this.isQuanX()
        ? $prefs.valueForKey(t)
        : this.isNode()
        ? ((this.data = this.loaddata()), this.data[t])
        : (this.data && this.data[t]) || null
    }
    setval(t, e) {
      return this.isSurge() || this.isLoon()
        ? $persistentStore.write(t, e)
        : this.isQuanX()
        ? $prefs.setValueForKey(t, e)
        : this.isNode()
        ? ((this.data = this.loaddata()),
          (this.data[e] = t),
          this.writedata(),
          !0)
        : (this.data && this.data[e]) || null
    }
    initGotEnv(t) {
      ;(this.got = this.got ? this.got : require('got')),
        (this.cktough = this.cktough ? this.cktough : require('tough-cookie')),
        (this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar()),
        t &&
          ((t.headers = t.headers ? t.headers : {}),
          void 0 === t.headers.Cookie &&
            void 0 === t.cookieJar &&
            (t.cookieJar = this.ckjar))
    }
    get(t, e = () => {}) {
      t.headers &&
        (delete t.headers['Content-Type'], delete t.headers['Content-Length']),
        this.isSurge() || this.isLoon()
          ? (this.isSurge() &&
              this.isNeedRewrite &&
              ((t.headers = t.headers || {}),
              Object.assign(t.headers, { 'X-Surge-Skip-Scripting': !1 })),
            $httpClient.get(t, (t, s, i) => {
              !t && s && ((s.body = i), (s.statusCode = s.status)), e(t, s, i)
            }))
          : this.isQuanX()
          ? (this.isNeedRewrite &&
              ((t.opts = t.opts || {}), Object.assign(t.opts, { hints: !1 })),
            $task.fetch(t).then(
              (t) => {
                const { statusCode: s, statusCode: i, headers: r, body: o } = t
                e(null, { status: s, statusCode: i, headers: r, body: o }, o)
              },
              (t) => e(t)
            ))
          : this.isNode() &&
            (this.initGotEnv(t),
            this.got(t)
              .on('redirect', (t, e) => {
                try {
                  if (t.headers['set-cookie']) {
                    const s = t.headers['set-cookie']
                      .map(this.cktough.Cookie.parse)
                      .toString()
                    this.ckjar.setCookieSync(s, null),
                      (e.cookieJar = this.ckjar)
                  }
                } catch (t) {
                  this.logErr(t)
                }
              })
              .then(
                (t) => {
                  const {
                    statusCode: s,
                    statusCode: i,
                    headers: r,
                    body: o,
                  } = t
                  e(null, { status: s, statusCode: i, headers: r, body: o }, o)
                },
                (t) => {
                  const { message: s, response: i } = t
                  e(s, i, i && i.body)
                }
              ))
    }
    post(t, e = () => {}) {
      if (
        (t.body &&
          t.headers &&
          !t.headers['Content-Type'] &&
          (t.headers['Content-Type'] = 'application/x-www-form-urlencoded'),
        t.headers && delete t.headers['Content-Length'],
        this.isSurge() || this.isLoon())
      )
        this.isSurge() &&
          this.isNeedRewrite &&
          ((t.headers = t.headers || {}),
          Object.assign(t.headers, { 'X-Surge-Skip-Scripting': !1 })),
          $httpClient.post(t, (t, s, i) => {
            !t && s && ((s.body = i), (s.statusCode = s.status)), e(t, s, i)
          })
      else if (this.isQuanX())
        (t.method = 'POST'),
          this.isNeedRewrite &&
            ((t.opts = t.opts || {}), Object.assign(t.opts, { hints: !1 })),
          $task.fetch(t).then(
            (t) => {
              const { statusCode: s, statusCode: i, headers: r, body: o } = t
              e(null, { status: s, statusCode: i, headers: r, body: o }, o)
            },
            (t) => e(t)
          )
      else if (this.isNode()) {
        this.initGotEnv(t)
        const { url: s, ...i } = t
        this.got.post(s, i).then(
          (t) => {
            const { statusCode: s, statusCode: i, headers: r, body: o } = t
            e(null, { status: s, statusCode: i, headers: r, body: o }, o)
          },
          (t) => {
            const { message: s, response: i } = t
            e(s, i, i && i.body)
          }
        )
      }
    }
    put(t, e = () => {}) {
      if (
        (t.body &&
          t.headers &&
          !t.headers['Content-Type'] &&
          (t.headers['Content-Type'] = 'application/x-www-form-urlencoded'),
        t.headers && delete t.headers['Content-Length'],
        this.isSurge() || this.isLoon())
      )
        this.isSurge() &&
          this.isNeedRewrite &&
          ((t.headers = t.headers || {}),
          Object.assign(t.headers, { 'X-Surge-Skip-Scripting': !1 })),
          $httpClient.put(t, (t, s, i) => {
            !t && s && ((s.body = i), (s.statusCode = s.status)), e(t, s, i)
          })
      else if (this.isQuanX())
        (t.method = 'PUT'),
          this.isNeedRewrite &&
            ((t.opts = t.opts || {}), Object.assign(t.opts, { hints: !1 })),
          $task.fetch(t).then(
            (t) => {
              const { statusCode: s, statusCode: i, headers: r, body: o } = t
              e(null, { status: s, statusCode: i, headers: r, body: o }, o)
            },
            (t) => e(t)
          )
      else if (this.isNode()) {
        this.initGotEnv(t)
        const { url: s, ...i } = t
        this.got.put(s, i).then(
          (t) => {
            const { statusCode: s, statusCode: i, headers: r, body: o } = t
            e(null, { status: s, statusCode: i, headers: r, body: o }, o)
          },
          (t) => {
            const { message: s, response: i } = t
            e(s, i, i && i.body)
          }
        )
      }
    }
    delete(t, e = () => {}) {
      if (
        (t.body &&
          t.headers &&
          !t.headers['Content-Type'] &&
          (t.headers['Content-Type'] = 'application/x-www-form-urlencoded'),
        t.headers && delete t.headers['Content-Length'],
        this.isSurge() || this.isLoon())
      )
        this.isSurge() &&
          this.isNeedRewrite &&
          ((t.headers = t.headers || {}),
          Object.assign(t.headers, { 'X-Surge-Skip-Scripting': !1 })),
          $httpClient.delete(t, (t, s, i) => {
            !t && s && ((s.body = i), (s.statusCode = s.status)), e(t, s, i)
          })
      else if (this.isQuanX())
        (t.method = 'delete'),
          this.isNeedRewrite &&
            ((t.opts = t.opts || {}), Object.assign(t.opts, { hints: !1 })),
          $task.fetch(t).then(
            (t) => {
              const { statusCode: s, statusCode: i, headers: r, body: o } = t
              e(null, { status: s, statusCode: i, headers: r, body: o }, o)
            },
            (t) => e(t)
          )
      else if (this.isNode()) {
        this.initGotEnv(t)
        const { url: s, ...i } = t
        this.got.delete(s, i).then(
          (t) => {
            const { statusCode: s, statusCode: i, headers: r, body: o } = t
            e(null, { status: s, statusCode: i, headers: r, body: o }, o)
          },
          (t) => {
            const { message: s, response: i } = t
            e(s, i, i && i.body)
          }
        )
      }
    }
    time(t) {
      let e = {
        'M+': new Date().getMonth() + 1,
        'd+': new Date().getDate(),
        'H+': new Date().getHours(),
        'm+': new Date().getMinutes(),
        's+': new Date().getSeconds(),
        'q+': Math.floor((new Date().getMonth() + 3) / 3),
        S: new Date().getMilliseconds(),
      }
      ;/(y+)/.test(t) &&
        (t = t.replace(
          RegExp.$1,
          (new Date().getFullYear() + '').substr(4 - RegExp.$1.length)
        ))
      for (let s in e)
        new RegExp('(' + s + ')').test(t) &&
          (t = t.replace(
            RegExp.$1,
            1 == RegExp.$1.length
              ? e[s]
              : ('00' + e[s]).substr(('' + e[s]).length)
          ))
      return t
    }
    msg(e = t, s = '', i = '', r) {
      const o = (t) => {
        if (!t) return t
        if ('string' == typeof t)
          return this.isLoon()
            ? t
            : this.isQuanX()
            ? { 'open-url': t }
            : this.isSurge()
            ? { url: t }
            : void 0
        if ('object' == typeof t) {
          if (this.isLoon()) {
            let e = t.openUrl || t.url || t['open-url'],
              s = t.mediaUrl || t['media-url']
            return { openUrl: e, mediaUrl: s }
          }
          if (this.isQuanX()) {
            let e = t['open-url'] || t.url || t.openUrl,
              s = t['media-url'] || t.mediaUrl
            return { 'open-url': e, 'media-url': s }
          }
          if (this.isSurge()) {
            let e = t.url || t.openUrl || t['open-url']
            return { url: e }
          }
        }
      }
      this.isMute ||
        (this.isSurge() || this.isLoon()
          ? $notification.post(e, s, i, o(r))
          : this.isQuanX() && $notify(e, s, i, o(r)))
      let h = [
        '',
        '==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3==============',
      ]
      h.push(e),
        s && h.push(s),
        i && h.push(i),
        console.log(h.join('\n')),
        (this.logs = this.logs.concat(h))
    }
    log(...t) {
      t.length > 0 && (this.logs = [...this.logs, ...t]),
        console.log(t.join(this.logSeparator))
    }
    logErr(t, e) {
      const s = !this.isSurge() && !this.isQuanX() && !this.isLoon()
      s
        ? this.log('', `\u2757\ufe0f${this.name}, \u9519\u8bef!`, t.stack)
        : this.log('', `\u2757\ufe0f${this.name}, \u9519\u8bef!`, t)
    }
    wait(t) {
      return new Promise((e) => setTimeout(e, t))
    }
    done(t = {}) {
      const e = new Date().getTime(),
        s = (e - this.startTime) / 1e3
      this.log(
        '',
        `\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`
      ),
        this.log(),
        (this.isSurge() || this.isQuanX() || this.isLoon()) && $done(t)
    }
  })(t, e)
}
