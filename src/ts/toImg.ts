import html2canvas from 'html2canvas'

export function exportImg(svgdiv: HTMLDivElement, name: string): void { // 导出图片
  const width = (svgdiv.scrollWidth > svgdiv.offsetWidth ? svgdiv.scrollWidth : svgdiv.offsetWidth)
  const height = svgdiv.offsetHeight
  const scale = window.devicePixelRatio * 2 // 放大倍数
  html2canvas(svgdiv, {
    backgroundColor: 'red',
    scale,
    width,
    height,
    // scrollX: 20,
    // scrollY: 25,
  }).then(canvas => {
    let url = ''
    if ('download' in document.createElement('a')) { // 非IE下载
      url = canvas.toDataURL('image/png')
      const elink = document.createElement('a')
      elink.style.display = 'none'
      elink.href = url
      elink.download = name
      document.body.appendChild(elink)
      elink.click()
      window.URL.revokeObjectURL(elink.href) // 释放URL 对象
      document.body.removeChild(elink)
    } else if (window.navigator.msSaveBlob) { // IE10+下载
      url = canvas.toDataURL()
      const blob = new Blob([url])
      window.navigator.msSaveBlob(blob, name)
    } else {
      console.warn('请尝试用最新版浏览器或者Google Chrome浏览器')
    }
  }).catch(err => {
    console.warn('html2canvas:', err)
    // this.$message.warning('请尝试用最新版浏览器或者Google Chrome浏览器')
  })
}
