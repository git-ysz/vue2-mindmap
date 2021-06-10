import * as d3ScaleChromatic from 'd3-scale-chromatic'
import * as d3Scale from 'd3-scale'
// const color = ['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a', '#ffff99', '#b15928']
// console.log(d3ScaleChromatic.schemePaired)
const colorScale = d3Scale.scaleOrdinal(d3ScaleChromatic.schemePaired) // 颜色列表
let colorNumber = 0
let size: Function // 生成size的函数
let gKey = 0

function initColor(d: Mdata, c?: string) { // 初始化颜色
  let color
  if (d.mid !== '0') {
    color = c || colorScale(`${colorNumber += 1}`)
    d.color = color
  }
  const { children, _children } = d
  if (children) {
    for (let i = 0; i < children.length; i += 1) {
      initColor(children[i], color)
    }
  }
  if (_children) {
    for (let i = 0; i < _children.length; i += 1) {
      initColor(_children[i], color)
    }
  }
}

function initSize(d: Mdata) { // 初始化size
  d.size = size(d.name, d.mid === '0')
  const { children, _children } = d
  if (children) {
    for (let i = 0; i < children.length; i += 1) {
      initSize(children[i])
    }
  }
  if (_children) {
    for (let i = 0; i < _children.length; i += 1) {
      initSize(_children[i])
    }
  }
}

function _getSource(d: Mdata, parentData?: Data) { // 返回源数据(未折叠的，无_children)
  const { children, _children } = d
  const nd: Data = { name: d.name }
  let isValid = d.isValid
  if (parentData) {
    // console.log(parentData.isValid, isValid)
    if (parentData.isValid === false && isValid === undefined) {
      isValid = parentData.isValid
    }
  }
  nd.left = d.left
  nd.dataId = d.dataId
  nd.collapse = d.collapse
  nd.isValid = isValid === undefined ? true : isValid
  // 添加自定义属性（要更新Mdata Data类型）
  // ...
  if (children?.length) {
    const { length } = children
    nd.children = new Array(length)
    for (let i = 0; i < length; i++) {
      nd.children[i] = _getSource(children[i], nd)
    }
  } else if (_children?.length) {
    const { length } = _children
    nd.children = new Array(length)
    for (let i = 0; i < length; i++) {
      nd.children[i] = _getSource(_children[i], nd)
    }
  } else {
    nd.children = []
  }
  // console.log(nd)
  return nd
}

function initId(d: Mdata, mid = '0', isValid?: boolean) { // 初始化唯一标识：待优化
  d.mid = mid
  d.gKey = d.gKey || (gKey += 1)
  d.isValid = d.isValid === undefined ? isValid : d.isValid
  const { children, _children, collapse } = d
  // console.log(11)
  if (children?.length && _children?.length) {
    console.error('[Mindmap warn]: Error in data: data.children and data._children cannot contain data at the same time')
  } else {
    // if (collapse && d.children?.length) {
    //   d._children = d.children
    //   d.children = []
    // }
    // 实时更新数据
    if (collapse) {
      d._children = d._children?.length ? d._children : d.children
      d.children = []
    } else {
      d.children = d.children?.length ? d.children : d._children
      d._children = []
    }
    if (children) {
      for (let i = 0; i < children.length;) {
        if (children[i].mid === 'del') {
          children.splice(i, 1)
        } else {
          initId(children[i], `${mid}-${i}`, d.isValid)
          i += 1
        }
      }
    }
    if (_children) {
      for (let i = 0; i < _children.length;) {
        if (_children[i].mid === 'del') {
          _children.splice(i, 1)
        } else {
          initId(_children[i], `${mid}-${i}`, d.isValid)
          i += 1
        }
      }
    }
  }
}

function initLeft(d: Mdata, left = false) {
  d.left = left
  const { children, _children } = d
  if (children) {
    for (let i = 0; i < children.length; i += 1) {
      initLeft(children[i], d.left)
    }
  }
  if (_children) {
    for (let i = 0; i < _children.length; i += 1) {
      initLeft(_children[i], d.left)
    }
  }
}

class ImData {
  data: Mdata
  constructor(d: Data, fn: Function) {
    size = fn
    this.data = JSON.parse(JSON.stringify(d))
    initId(this.data)
    initColor(this.data)
    initSize(this.data)

    this.data.left = false
    // this.data.collapse = false
    const { children, _children } = this.data
    if (children) {
      for (let i = 0; i < children.length; i += 1) {
        initLeft(children[i], children[i].left)
      }
    }
    if (_children) {
      for (let i = 0; i < _children.length; i += 1) {
        initLeft(_children[i], _children[i].left)
      }
    }
  }

  getSource(mid = '0') {
    // console.log('getSource')
    const d = this.find(mid)
    return d ? _getSource(d) : { name: '' }
  }

  resize(mid = '0') { // 更新size
    const d = this.find(mid)
    if (d) {
      initSize(d)
    }
  }

  find(mid: string) { // 根据id找到数据
    const array = mid.split('-').map(n => ~~n)
    let data = this.data
    for (let i = 1; i < array.length; i++) {
      if (data && data.children?.length) {
        data = data.children[array[i]]
      } else if (data && data._children?.length) { // No data matching mid
        data = data._children[array[i]]
      } else { // No data matching mid
        return null
      }
    }
    return data
  }

  rename(mid: string, name: string) { // 修改名称
    if (mid.length > 0) {
      const d = this.find(mid)
      if (d) {
        d.name = name
        d.size = size(name, d.mid === '0')
      }
      return d
    }
  }

  setValid(mid: string | string[], value: boolean) { // 设置有效标记
    const arr = Array.isArray(mid) ? mid : [mid]
    // const d = this.find(mid)
    for (let i = 0; i < arr.length; i++) {
      const idChild = arr[i]
      const d = this.find(idChild)
      if (d) {
        d.isValid = value
        if (d.children?.length) {
          this.setValid(d.children.map(k => k.mid), value)
        } else if (d._children?.length) {
          this.setValid(d._children.map(k => k.mid), value)
        }
      }
    }
  }

  collapse(mid: string | string[]) { // 折叠
    const arr = Array.isArray(mid) ? mid : [mid]
    for (let i = 0; i < arr.length; i++) {
      const idChild = arr[i]
      const d = this.find(idChild)
      if (d && (!d._children || d._children.length === 0) && !d.collapse) {
        d.collapse = true
        d._children = d.children
        d.children = []
      }
    }
  }

  expand(mid: string | string[]) { // 展开
    const arr = Array.isArray(mid) ? mid : [mid]
    for (let i = 0; i < arr.length; i++) {
      const idChild = arr[i]
      const d = this.find(idChild)
      if (d && (!d.children || d.children.length === 0) && d.collapse) {
        // console.log('展开', d)
        d.collapse = false
        d.children = d._children
        d._children = []
      }
    }
  }

  expandLevel(level: number, mid: string | string[]) { // 展开某一级别
    if (!level) {
      return
    }
    this.expand(mid)
    const arr = Array.isArray(mid) ? mid : [mid]
    for (let i = 0; i < arr.length; i++) {
      const d = this.find(arr[i])
      if (d) {
        if (d.children?.length) {
          this.expandLevel(level - 1, d.children.map(e => e.mid))
        } else if (d._children?.length) {
          this.expandLevel(level - 1, d._children.map(e => e.mid))
        }
      }
    }
  }

  expandAll(mid: string | string[], level?: number) { // 展开下级节点（level:控制展开的层级数）
    const arr = Array.isArray(mid) ? mid : [mid]
    for (let i = 0; i < arr.length; i++) {
      const idChild = arr[i]
      const d = this.find(idChild)
      if (d) {
        d.collapse = false
        if (!d.children || !d.children.length) {
          d.children = d._children
        }
        d._children = []
        if (d?.children && d?.children.length && level !== 0) {
          if (level === undefined) {
            this.expandAll(d.children.map(i => i.mid))
          } else {
            this.expandAll(d.children.map(i => i.mid), level - 1)
          }
        }
      }
    }
  }

  del(mid: string | string[]) { // 删除指定id的数据
    const arr = Array.isArray(mid) ? mid : [mid]
    let p
    for (let i = 0; i < arr.length; i++) {
      const idChild = arr[i]
      const idArr = idChild.split('-')
      if (idArr.length >= 2) { // 有parent，非根节点
        const delIndex = idArr.pop()
        const parent = this.find(idArr.join('-'))
        if (delIndex && parent) {
          if (parent.children) {
            parent.children[~~delIndex].mid = 'del' // 更新id时删除
          }
          if (p === undefined || (p.mid.split('-').length > parent.mid.split('-').length)) { // 找出最高的parent
            p = parent
          }
        }
      }
    }
    if (p) {
      initId(p, p.mid)
    }
  }

  add(mid: string, child: Data) { // 添加新的子节点
    if (mid.length > 0) {
      const parent = this.find(mid)
      if (parent) {
        child.isValid = child.isValid === undefined ? parent?.isValid : child.isValid
        if ((parent._children?.length || 0) > 0) { // 判断是否折叠，如果折叠，展开
          parent.children = parent._children
          parent._children = []
        }
        const c: Mdata = JSON.parse(JSON.stringify(child))
        initLeft(c, parent.left)
        parent.children ? parent.children.push(c) : parent.children = [c]
        initColor(c, parent.color || colorScale(`${colorNumber += 1}`))
        initId(c, `${parent.mid}-${parent.children.length - 1}`)
        initSize(c)
        return c
      }
    }
  }

  insert(mid: string, d: Data, i = 0) { // 插入新的节点在前（或在后）
    if (mid.length > 2) {
      const idArr = mid.split('-')
      const bId = idArr.pop()
      const pId = idArr.join('-')
      const parent = this.find(pId)
      if (bId && parent) {
        const c: Mdata = JSON.parse(JSON.stringify(d))
        const pChildren = parent.children
        if (pChildren) {
          pChildren.splice(~~bId + i, 0, c)
          c.left = pChildren[~~bId].left
        }
        initColor(c, parent.color || colorScale(`${colorNumber += 1}`))
        initId(parent, parent.mid)
        initSize(c)
        return c
      }
    }
  }

  move(delId: string, insertId?: string, i = 0) { // 节点在同层移动
    if (delId.length > 2) {
      if (!insertId) { // 左右转换
        const del = this.find(delId)
        if (del) {
          initLeft(del, !del.left)
        }
      } else if (insertId.length > 2) {
        const insert = this.find(insertId)
        const idArr = delId.split('-')
        const delIndexS = idArr.pop()
        const pId = idArr.join('-')
        const parent = this.find(pId)
        const insertIndexS = insertId.split('-').pop()

        if (delIndexS && insertIndexS && insert && parent && parent.children) {
          const delIndex = ~~delIndexS
          let insertIndex = ~~insertIndexS
          // 删除时可能会改变插入的序号
          if (delIndex < insertIndex) {
            insertIndex -= 1
          }
          const del = parent.children.splice(delIndex, 1)[0]
          if (del.left !== insert.left) { // 左右转换
            initLeft(del, insert.left)
          }
          parent.children.splice(insertIndex + i, 0, del)
          initId(parent, parent.mid)
        }
      }
    }
  }

  reparent(parentId: string, delId: string) { // 节点移动到其他层
    if (delId.length > 2 && parentId.length > 0 && parentId !== delId) {
      const np = this.find(parentId)
      const idArr = delId.split('-')
      const delIndex = idArr.pop()
      const delParentId = idArr.join('-')
      const delParent = this.find(delParentId)
      if (delIndex && delParent && np) {
        const del = delParent.children?.splice(~~delIndex, 1)[0] // 删除
        if (del) {
          (np.children?.length || 0) > 0 ? np.children?.push(del)
            : ((np._children?.length || 0) > 0 ? np._children?.push(del) : np.children = [del])

          initColor(del, parentId === '0' ? colorScale(`${colorNumber += 1}`) : np.color)
          initLeft(del, parentId === '0' ? del.left : np.left)
          initId(np, np.mid)
          initId(delParent, delParent.mid)
        }
      }
    }
  }
}

export default ImData
