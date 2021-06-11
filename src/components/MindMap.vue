<template>
  <div ref="mindmap" id="mindmap" :style="mmStyle">
    <div ref="mindmapSvgDiv" style="display: flex; width:100%; height:100%;background-color: #eeeef3;">
      <svg ref="svg" tabindex="0" :class="svgClass">
        <g ref="content" id="content"></g>
        <rect v-show="showSelectedBox" id="selectedBox" ref='selectedBox' :width='seleBox.width' :height='seleBox.height'
          :transform="`translate(${seleBox.x},${seleBox.y})`"
        ></rect>
      </svg>
    </div>
    <div>
      <input
        v-if="showSearch"
        v-model="search"
        type="text"
        :class="['search-input', searchClassName]"
        :placeholder="searchPlaceholder"
        :style="searchStyle"
        @keydown.enter="searchNode()"
        @blur="search = '';searchNode()"
      />
      <slot>
        <select id="expandLevel" style="position: absolute;" @change="el => expandLevel(el.target.value)">
          <option :value="1">展开一级</option>
          <option :value="2">展开二级</option>
          <option :value="3">展开三级</option>
          <option :value="4">展开四级</option>
        </select>
      </slot>
    </div>
    <div ref="dummy" id="dummy"></div>
    <div
      ref="menu"
      id="menu"
      tabindex="0"
      v-show="showContextMenu"
      :style="{ top: contextMenuY+'px', left: contextMenuX+'px' }"
      @blur="showContextMenu = false"
    >
      <div
        v-for="item in contextMenuItems"
        v-show="item.show"
        :key="item.name"
        :class="`menu-item ${item.disabled ? 'disabled' : ''}`"
        @click="item.disabled ? null : clickMenu(item.name)"
      >
        <div>{{ item.title }}</div>
      </div>
    </div>
    <div class="buttonList right-bottom">
      <template v-if="zoomable">
        <div @click="scaleView(true)">
          <slot name="zoom-in-btn">
            <button class="icon" ref="zoomIn" type="button">
              <i class="zoom-in"></i>
            </button>
          </slot>
        </div>
        <div @click="scaleView(false)">
          <slot name="zoom-out-btn">
            <button class="icon" ref="zoomOut" type="button">
              <i class="zoom-out"></i>
            </button>
          </slot>
        </div>
      </template>
      <div v-if="gps" @click="makeCenter()">
        <slot name="gps-btn">
          <button class="icon" ref="gps" type="button">
            <i class="gps"></i>
          </button>
        </slot>
      </div>
      <div v-if="fitView" @click="fitContent()">
        <slot name="fit-btn">
          <button class="icon" ref="fitView" type="button">
            <i class="fitView"></i>
          </button>
        </slot>
      </div>
      <div v-if="download" @click="exportImg()">
        <slot name="download-btn">
          <button class="icon" ref="download" type="button">
            <i class="download"></i>
          </button>
        </slot>
      </div>
    </div>
    <div v-if="showUndo" class="buttonList top-right">
      <div @click="undo()">
        <slot name="undo-btn">
          <button class="icon" :class="{ disabled: !canUndo }" ref="undo" type="button">
            <i class="undo"></i>
          </button>
        </slot>
      </div>
      <div @click="redo()">
        <slot name="redo-btn">
          <button class="icon" :class="{disabled: !canRedo}" ref="redo" type="button">
            <i class="redo"></i>
          </button>
        </slot>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop, Model } from 'vue-property-decorator'
import * as d3 from '../ts/d3'
import { flextree } from 'd3-flextree'
import ImData from '../ts/ImData'
import History from '../ts/History'
import { exportImg } from '../ts/toImg'

let mmdata: ImData // 思维导图数据
@Component
export default class MindMap extends Vue {
  @Prop() width: number | undefined
  @Prop() height: number | undefined
  @Prop({ default: 55 }) xSpacing!: number
  @Prop({ default: 10 }) ySpacing!: number
  @Prop({ default: true }) draggable!: boolean
  @Prop({ default: true }) gps!: boolean
  @Prop({ default: true }) fitView!: boolean
  @Prop({ default: true }) download!: boolean
  @Prop({ default: true }) keyboard!: boolean
  @Prop({ default: true }) showNodeAdd!: boolean
  // 自定义添加，点击gBtn时，响应$emit('customAdd')事件
  @Prop({ default: false }) customAdd!: boolean
  @Prop({ default: true }) contextMenu!: boolean
  @Prop({ default: true }) zoomable!: boolean
  @Prop({ default: true }) showUndo!: boolean
  // 是否可编辑（修改，拖动等）
  @Prop({ default: true }) editable!: boolean
  @Prop({ default: 2 }) strokeWidth!: number
  // 缩放频率
  @Prop({ default: 1 }) zoomStep!: number
  // 缩放限制
  @Prop({ default: () => [0.5, 8] }) scaleExtent!: [number, number]
  // 搜索框
  @Prop({ default: true }) showSearch!: boolean
  @Prop({ default: '请输入搜索值' }) searchPlaceholder!: string
  @Prop({ default: () => ({}) }) searchStyle!: object
  @Prop({ default: '' }) searchClassName!: string
  // 是否可以删除
  @Prop({ default: true }) nodeDel!: boolean
  // 是否可以更改有效状态
  @Prop({ default: true }) valid!: boolean

  @Model('change', { required: true }) value!: Array<Data>

  @Watch('keyboard')
  onKeyboardChanged(val: boolean) { this.makeKeyboard(val) }
  @Watch('editable')
  onEditableChanged(val: boolean) {
    this.makeNodeAdd(this.showNodeAdd)
    this.makeDrag(this.draggable)
  }
  @Watch('showNodeAdd')
  onShowNodeAddChanged(val: boolean) { this.makeNodeAdd(val) }
  @Watch('customAdd')
  onCustomAddChanged(val: boolean) { this.makeNodeAdd(this.showNodeAdd) }
  @Watch('draggable')
  onDraggableChanged(val: boolean) { this.makeDrag(val) }
  @Watch('contextMenu')
  onContextMenuChanged(val: boolean) { this.makeContextMenu(val) }
  @Watch('xSpacing')
  onXSpacingChanged() {
    mmdata.resize()
    this.updateMmdata()
    this.updateMindmap()
  }
  @Watch('ySpacing')
  onYSpacingChanged() { this.updateMindmap() }
  @Watch('zoomable')
  onZoomableChanged(val: boolean) { this.makeZoom(val) }

  $refs!: {
    mindmap: HTMLDivElement
    mindmapSvgDiv: HTMLDivElement
    svg: Element
    content: Element
    dummy: HTMLDivElement
    menu: HTMLDivElement
    selectedBox: SVGRectElement
  }
  // 需要复制的数据
  copySource: Data = { name: '' }
  // 搜索框绑定值
  search = ''
  dragFlag = false
  multiSeleFlag = false
  minTextWidth = 30
  minTextHeight = 21
  gBtnSide = 24 // gBtn边长
  foreignBorderWidth = 3
  spaceKey = false
  toRecord = true // 判断是否需要记录mmdata的数据快照
  toUpdate = true // 判断是否需要更新mmdata
  dTop!: FlexNode // mmdata中纵坐标最高的数据
  root!: FlexNode // 包含位置信息的mmdata
  showContextMenu = false
  showSelectedBox = false // 选中框
  contextMenuX = 0
  contextMenuY = 0
  mouse = { x0: 0, y0: 0, x1: 0, y1: 0 }
  contextMenuTarget!: Mdata | Mdata[]
  // contextMenuItems = [
  //   { title: '新增子节点', name: 'add', disabled: false, show: this.editable },
  //   { title: '删除节点', name: 'delete', disabled: false, show: this.editable },
  //   { title: '折叠节点', name: 'collapse', disabled: false, show: true },
  //   { title: '展开节点', name: 'expand', disabled: false, show: true },
  //   { title: '复制节点', name: 'copy', disabled: false, show: this.editable },
  //   { title: '粘贴为子节点', name: 'paste', disabled: true, show: this.editable },
  // ]
  menuClientWidth = 125
  contextMenuItems = {
    valid: {
      title: '置为有效',
      name: 'valid',
      disabled: false,
      show: this.editable && this.valid,
    },
    add: {
      title: '新增子节点',
      name: 'add',
      disabled: false,
      show: this.editable,
    },
    delete: {
      title: '删除节点',
      name: 'delete',
      disabled: false,
      show: this.editable && this.nodeDel,
    },
    collapse: {
      title: '折叠节点',
      name: 'collapse',
      disabled: false,
      show: true,
    },
    expand: {
      title: '展开此节点',
      name: 'expand',
      disabled: false,
      show: true,
    },
    expandNextLevel: {
      title: '展开下级',
      name: 'expandNextLevel',
      disabled: false,
      show: true,
    },
    expandAll: {
      title: '展开所有下级',
      name: 'expandAll',
      disabled: false,
      show: true,
    },
    copy: {
      title: '复制节点',
      name: 'copy',
      disabled: false,
      show: this.editable,
    },
    paste: {
      title: '粘贴为子节点',
      name: 'paste',
      disabled: true,
      show: this.editable,
    },
  }
  mindmapSvgDiv!: d3.Selection<HTMLDivElement, FlexNode, null, undefined>
  mindmapSvg!: d3.Selection<Element, FlexNode, null, undefined>
  mindmapG!: d3.Selection<Element, FlexNode, null, undefined>
  dummy!: d3.Selection<HTMLDivElement, FlexNode, null, undefined>
  mindmapSvgZoom!: d3.ZoomBehavior<Element, FlexNode>
  easePolyInOut = d3.transition().duration(1000).ease(d3.easePolyInOut)
  link = d3.linkHorizontal().x((d) => d[0]).y((d) => d[1])
  zoom = d3.zoom() as d3.ZoomBehavior<Element, FlexNode>
  history = new History()
  get menuClientHeight() {
    let height = 10
    for (const key in this.contextMenuItems) {
      const element = this.contextMenuItems[key]
      if (element.show) {
        height += 21
      }
    }
    return height
  }
  // 展开某一级节点
  expandLevel(level: number) {
    mmdata.expandLevel(level - 0, '0')
    this.updateMmdata()
  }
  // 按一定程度缩放，true时放大，false缩小
  scaleView(flag: boolean) {
    try {
      this.zoom.scaleBy(this.mindmapSvg, flag ? 1.1 : 0.9)
    } catch (error) {
      console.warn('缩放:', error)
    }
  }
  getSource(mid?: string) { // 获取数据源mid的数据源
    return mmdata.getSource(mid)
  }
  copy(tragetId: string) { // 复制
    try {
      this.copySource = this.getSource(tragetId)
      this.contextMenuItems.paste.disabled = false
      this.$emit('copy', this.copySource, tragetId)
    } catch (error) {
      console.warn('复制:', error)
    }
  }
  paste(parentId: string) { // 粘贴
    try {
      this.add(parentId, this.copySource)
      this.$emit('paste', this.copySource, parentId)
    } catch (error) {
      console.warn('粘贴:', error)
    }
  }
  async selectNodeBySearch(n: HTMLDivElement) {
    try {
      await this.fitContent()
      await this.makeCenter()
    } catch (error) {
      console.log(error)
    } finally {
      this.removeMultiSelected()
      this.$nextTick(() => {
        n.setAttribute('class', 'focus')
      })
    }
  }
  findIncludesName(children: Mdata[], searchStr: string, onlyCollapse = true): boolean { // 查找字符是否在某个集合中
    if (!children.length) {
      return false
    }
    let flag = false
    for (let index = 0; index < children.length; index++) {
      const element = children[index]
      if (element.name.includes(searchStr)) {
        flag = true
      } else if (onlyCollapse) {
        if (element.collapse || element._children?.length) {
          flag = this.findIncludesName(element._children || [], searchStr, onlyCollapse)
        }
      } else {
        const child: Mdata[] = element.children?.length ? element.children : (element._children || [])
        flag = this.findIncludesName(child, searchStr, onlyCollapse)
      }
      if (flag) {
        break
      }
    }
    return flag
  }
  expandIncludesName(gNode: d3.Selection<Element, FlexNode, null, undefined>, searchStr: string) { // 展开包含字符的节点
    ;(gNode.selectAll('g.gEllipsis.show') as d3.Selection<Element, FlexNode, Element, FlexNode>).filter((d, i, n) => {
      // 返回字符和search相近的node
      const children: Mdata[] = d.data.children?.length ? d.data.children : (d.data._children || [])
      return this.findIncludesName(children, searchStr, false)
    }).each((cd, ci, cn) => {
      this.expand(cd.data)
      const children: Mdata[] = cd.data.children?.length ? cd.data.children : (cd.data._children || [])
      if (this.findIncludesName(children, searchStr, false)) { // 多级嵌套折叠时，逐级展开
        this.expandIncludesName(gNode, searchStr)
      }
    })
  }
  searchNode() { // 搜索节点
    // 清空上一次搜索出来的节点
    (d3.selectAll('div.focus') as d3.Selection<Element, FlexNode, Element, FlexNode>).each((d, i, n) => {
      (n[i] as HTMLDivElement).setAttribute('class', '')
    })
    const searchStr = this.search
    if (!searchStr) {
      return
    }
    // 所有未折叠节点
    const mindmapG = this.mindmapG.selectAll('g.node') as d3.Selection<Element, FlexNode, Element, FlexNode>
    mindmapG.each((d, i, n) => {
      const gNode = d3.select(n[i]) as d3.Selection<Element, FlexNode, null, undefined>
      // 将匹配项的折叠节点的展开
      this.expandIncludesName(gNode, searchStr)
      // 折叠起来的查不到（在此之前将匹配项的父级展开）
      this.$nextTick(() => {
        const divNode = gNode.selectAll('foreignObject > div') as d3.Selection<Element, FlexNode, Element, FlexNode>
        // 更改匹配项的背景
        divNode.filter((cd) => !!cd.data.name.includes(searchStr)).each((cd, ci, cn) => this.selectNodeBySearch(cn[ci] as HTMLDivElement))
      })
    })
  }
  mindmapGRightClick(d: FlexNode, i: number, n: ArrayLike<Element>) {
    d3.event.preventDefault()
    // if (n.length !== 1) {
    //   return
    // }
    // console.log(d, i, n)
  }
  async exportImg() { // 导出图片
    try {
      await this.fitContent()
      await this.makeCenter()
    } catch (error) {
      console.warn(error)
    } finally {
      this.$nextTick(() => {
        const data = this.getSource()
        const filename = data.name + '.png'
        exportImg(this.$refs.mindmapSvgDiv, filename)
      })
    }
  }
  get mmStyle() {
    return {
      width: this.width ? `${this.width}px` : '100%',
      height: this.height ? `${this.height}px` : '',
    }
  }
  get svgClass() { return `stroke-width-${this.strokeWidth} ${this.spaceKey && this.zoomable ? 'grab' : ''}` }
  get canUndo() { return this.history.canUndo }
  get canRedo() { return this.history.canRedo }
  get seleBox() {
    const { x0, x1, y0, y1 } = this.mouse
    const x = Math.min(x0, x1)
    const y = Math.min(y0, y1)
    const width = Math.abs(x0 - x1)
    const height = Math.abs(y0 - y1)
    return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height }
  }

  getViewPos(p?: DOMRect) {
    const svgPos = this.$refs.svg.getBoundingClientRect()
    const { pageX, pageY } = d3.event
    const viewLeft = svgPos.left + window.pageXOffset
    const viewTop = svgPos.top + window.pageYOffset
    const { left, top, right, bottom } = p || { left: pageX, top: pageY, right: pageX, bottom: pageY }
    return {
      left: left - viewLeft,
      top: top - viewTop,
      right: right - viewLeft,
      bottom: bottom - viewTop,
    }
  }
  updateMmdata(val?: Mdata | null) { // 不可变数据
    if (val) { mmdata.data = JSON.parse(JSON.stringify(val)) }
    if (this.toRecord) {
      this.history.record(JSON.parse(JSON.stringify(mmdata.data)))
    }
    this.updateMindmap()
    this.toUpdate = false
    this.$emit('change', [this.getSource()])
  }
  init() {
    // 绑定元素
    this.mindmapSvgDiv = d3.select(this.$refs.mindmapSvgDiv)
    this.mindmapSvg = d3.select(this.$refs.svg)
    this.mindmapG = d3.select(this.$refs.content)
    this.mindmapG.style('opacity', 0)
    this.dummy = d3.select(this.$refs.dummy)
    // 绑定svg事件
    this.makeKeyboard(this.keyboard)
    this.mindmapSvg.on('contextmenu', this.mindmapGRightClick)
    // this.mindmapSvg.on('contextmenu', () => { d3.event.preventDefault() })
    this.mindmapSvgZoom = this.zoom.on('zoom', () => { this.mindmapG.attr('transform', d3.event.transform) })
      .filter(() => (
        (this.spaceKey && d3.event.type !== 'wheel')
      ) && !d3.event.button)
      .scaleExtent(this.scaleExtent) // 缩放倍数
      // .filter(() => (
      //   (d3.event.ctrlKey && d3.event.type !== 'mousedown')
      //   || (this.  && d3.event.type !== 'wheel')
      // ) && !d3.event.button) // 开启双指捏合 空格键+左键可拖移
    this.makeZoom(this.zoomable)
  }
  initNodeEvent() { // 绑定节点事件
    this.makeDrag(this.draggable)
    this.makeNodeAdd(this.showNodeAdd)
    this.makeContextMenu(this.contextMenu)
  }
  // 事件
  makeKeyboard(val: boolean) {
    val ? this.mindmapSvg.on('keydown', this.svgKeyDown).on('keyup', this.svgKeyUp)
      : this.mindmapSvg.on('keydown', null).on('keyup', null)
  }
  makeNodeAdd(val: boolean) {
    const fObject = this.mindmapG.selectAll('foreignObject') as d3.Selection<Element, FlexNode, Element, FlexNode>
    const gBtn = this.mindmapG.selectAll('.gButton') as d3.Selection<Element, FlexNode, Element, FlexNode>
    if (val && this.editable) {
      const { mouseLeave, mouseEnter, gBtnClick } = this
      fObject.on('mouseenter', mouseEnter).on('mouseleave', mouseLeave)
      gBtn.on('mouseenter', mouseEnter).on('mouseleave', mouseLeave).on('mousedown', gBtnClick)
    } else {
      fObject.on('mouseenter', null).on('mouseleave', null)
      gBtn.on('mouseenter', null).on('mouseleave', null).on('mousedown', null)
    }
  }
  makeContextMenu(val: boolean) {
    const selection = this.mindmapG.selectAll('foreignObject') as d3.Selection<Element, FlexNode, Element, FlexNode>
    // const svgDiv = this.mindmapSvgDiv.selectAll('svg') as d3.Selection<Element, FlexNode, Element, FlexNode>
    if (val) {
      selection.on('contextmenu', this.fObjectRightClick)
      // svgDiv.on('contextmenu', this.mindmapGRightClick)
    } else {
      selection.on('contextmenu', null)
    }
  }
  makeDrag(val: boolean) {
    const { mindmapG, dragged, fObjMousedown, dragended } = this
    const selection = mindmapG.selectAll('foreignObject') as d3.Selection<Element, FlexNode, Element, FlexNode>
    const drag = d3.drag().container((d, i, n) => n[i].parentNode?.parentNode as d3.DragContainerElement) as d3.DragBehavior<Element, FlexNode, FlexNode>
    if (!this.editable) { // 不可编辑
      selection.call(drag.on('start', null).on('drag', null).on('end', null))
    } else if (val) { // 可编辑，可拖拽
      selection.call(drag.on('start', fObjMousedown).on('drag', dragged).on('end', dragended))
    } else { // 可编辑，不可拖拽
      selection.call(drag.on('start', fObjMousedown).on('drag', null).on('end', dragended))
    }
  }
  makeZoom(val: boolean) {
    const { mindmapSvg, mindmapSvgZoom, zoom } = this
    if (val) {
      mindmapSvg.call(mindmapSvgZoom).on('dblclick.zoom', null)
        .on('wheel.zoom', () => {
          const { ctrlKey, deltaY, deltaX, x, y } = d3.event
          d3.event.preventDefault()
          const current = d3.zoomTransform(this.$refs.svg)
          if (!ctrlKey) { // 缩放
            const svgPos = this.$refs.svg.getBoundingClientRect()
            const px = svgPos.left + window.pageXOffset
            const py = svgPos.top + window.pageYOffset
            const k = current.k - deltaY * (this.zoomStep / 1000)
            zoom.scaleTo(mindmapSvg, k, [x - px, y - py])
          } else { // 移动
            zoom.translateBy(mindmapSvg, -deltaX, -deltaY)
          }
        })
    } else {
      mindmapSvg.on('.zoom', null)
    }
  }
  // button事件
  undo() {
    if (this.canUndo) {
      this.toRecord = false
      this.updateMmdata(this.history.undo())
    }
  }
  redo() {
    if (this.canRedo) {
      this.toRecord = false
      this.updateMmdata(this.history.redo())
    }
  }
  async makeCenter() { // 居中
    return new Promise((resolve, reject) => {
      // console.log(this.mindmapSvg)
      d3.transition().end().then(() => {
        // 先把原点居中，用于二次校准的值获取
        this.mindmapSvg.call(this.zoom.translateTo, 0, 0)

        const svgTransform = d3.zoomTransform(this.$refs.svg)
        const svgDivConNode = (d3.select(this.$refs.mindmapSvgDiv) as d3.Selection<HTMLDivElement, FlexNode, Element | null, FlexNode | undefined>).node()
        const divConRect = (svgDivConNode as Element).getBoundingClientRect()
        const svgConNode = (d3.select(this.$refs.content) as d3.Selection<Element, FlexNode, Element | null, FlexNode | undefined>).node()
        const conRect = (svgConNode as Element).getBoundingClientRect()
        const conLeftBySvg = conRect.left - divConRect.left
        const conTopBySvg = conRect.top - divConRect.top

        this.mindmapSvg.call(
          this.zoom.translateTo,
          (conLeftBySvg / svgTransform.k) - (divConRect.width / 2 / svgTransform.k) + (conRect.width / 2 / svgTransform.k),
          (conTopBySvg / svgTransform.k) - (divConRect.height / 2 / svgTransform.k) + (conRect.height / 2 / svgTransform.k),
        )
        resolve(true)
      }).catch(error => {
        reject(error)
      })
    })
  }
  async fitContent() { // 适应窗口大小
    return new Promise((resolve, reject) => {
      d3.transition().end().then(() => {
        const rect = (this.$refs.content as SVGGElement).getBBox()
        // console.log(rect)
        const div = this.$refs.mindmap
        // 余出边距50
        const multipleX = div.offsetWidth / (rect.width)
        const multipleY = div.offsetHeight / (rect.height + 50)
        const multiple = Math.min(multipleX, multipleY)
        // console.log(multipleX, multipleY, multiple)
        this.mindmapSvg.transition(this.easePolyInOut as any).call(this.zoom.scaleTo, multiple)
        resolve(true)
      }).catch(error => {
        reject(error)
      })
    })
  }
  // 数据操作
  add(parentId: string, d: Data) {
    this.toRecord = true
    const nd = mmdata.add(parentId, d)
    this.updateMmdata()
    return nd
  }
  insert(dPosition: Mdata, d: Data, i = 0) {
    this.toRecord = true
    const nd = mmdata.insert(dPosition.mid, d, i)
    this.updateMmdata()
    return nd
  }
  move(del: Mdata, insert?: Mdata, i = 0) {
    this.toRecord = true
    mmdata.move(del.mid, insert?.mid, i)
    this.updateMmdata()
  }
  reparent(p: Mdata, d: Mdata) {
    this.toRecord = true
    mmdata.reparent(p.mid, d.mid)
    this.updateMmdata()
  }
  del(s: Mdata | Mdata[]) {
    if (!this.nodeDel || !this.editable) {
      return
    }
    this.toRecord = true
    if (Array.isArray(s)) {
      const idArr = []
      for (let i = 0; i < s.length; i++) {
        idArr.push(s[i].mid)
      }
      mmdata.del(idArr)
    } else {
      mmdata.del(s.mid)
    }
    this.updateMmdata()
  }
  updateName(d: Mdata, name: string) {
    if (d.name !== name) { // 有改变
      this.toRecord = true
      const nd = mmdata.rename(d.mid, name)
      this.updateMmdata()
      return nd
    }
  }
  collapse(s: Mdata | Mdata[]) {
    this.toRecord = true
    if (Array.isArray(s)) {
      const idArr = []
      for (let i = 0; i < s.length; i++) {
        idArr.push(s[i].mid)
      }
      mmdata.collapse(idArr)
    } else {
      mmdata.collapse(s.mid)
    }
    this.updateMmdata()
  }
  expand(s: Mdata | Mdata[]) {
    this.toRecord = true
    if (Array.isArray(s)) {
      const idArr = []
      for (let i = 0; i < s.length; i++) {
        idArr.push(s[i].mid)
      }
      mmdata.expand(idArr)
    } else {
      mmdata.expand(s.mid)
    }
    this.updateMmdata()
  }
  expandAll(s: Mdata | Mdata[], level?: number) {
    this.toRecord = true
    // console.log(s)
    if (Array.isArray(s)) {
      const idArr = []
      for (let i = 0; i < s.length; i++) {
        idArr.push(s[i].mid)
      }
      mmdata.expandAll(idArr, level)
    } else {
      mmdata.expandAll(s.mid, level)
    }
    this.updateMmdata()
  }
  // 键盘
  svgKeyDown() {
    const event = d3.event
    const keyName = event.key as string
    // console.log(event, keyName)
    // 针对导图的操作
    if (keyName === ' ' && !this.spaceKey) { this.spaceKey = true }
    if (event.ctrlKey) {
      d3.event.preventDefault()
      if (keyName === 'z') { // 撤销
        this.undo()
      } else if (keyName === 'y') { // 重做
        this.redo()
      }
    }
    // 针对节点的操作
    const sele = d3.select('#selectedNode') as d3.Selection<Element, FlexNode, Element, FlexNode>
    const seleNode = sele.node()
    // console.log(keyName)
    if (seleNode) {
      const seleData = sele.data()[0]
      const seleDepth = seleData.depth
      const im = seleData.data
      const pNode = seleNode.parentNode as Element
      if (event.ctrlKey) {
        d3.event.preventDefault()
        if (keyName === 'c') { // 复制
          this.copy(im.mid)
        } else if (keyName === 'v') { // 粘贴
          this.paste(im.mid)
        }
      }
      // console.log(keyName)
      switch (keyName) {
        case 'Tab': {
          d3.event.preventDefault()
          const nd = this.add(im.mid, { name: '' })
          if (nd) {
            this.editNew(nd, seleDepth + 1, pNode)
          }
          break
        }
        case 'Enter': {
          d3.event.preventDefault()
          // 进入编辑状态
          this.editNew(im, seleDepth, pNode)
          // 添加兄弟节点
          // if (pNode === this.$refs.content) { // 根节点enter时，等效tab
          //   const nd = this.add(im.mid, { name: '' })
          //   if (nd) {
          //     this.editNew(nd, seleDepth + 1, pNode)
          //   }
          // } else {
          //   const nd = this.insert(im, { name: '' }, 1)
          //   if (nd) {
          //     this.editNew(nd, seleDepth, pNode)
          //   }
          // }
          break
        }
        // case 'Backspace': {
        //   d3.event.preventDefault()
        //   this.del(im)
        //   break
        // }
        // case 'Delete': {
        //   d3.event.preventDefault()
        //   this.del(im)
        //   break
        // }
        // case 'ArrowRight': {
        //   if (im.left && pNode) {
        //     this.selectNode(pNode)
        //   } else if (seleNode.querySelector('g.node')) {
        //     this.selectNode(seleNode.querySelector('g.node') as Element)
        //   }
        //   break
        // }
        // case 'ArrowLeft': {
        //   // console.log(im, seleNode.querySelector('g.node'), pNode)
        //   if (im.left && seleNode.querySelector('g.node')) {
        //     this.selectNode(seleNode.querySelector('g.node') as Element)
        //   } else if (im.mid === '0') {
        //     for (let dex = 0; dex < seleNode.children.length; dex++) {
        //       const ele = seleNode.children[dex]
        //       console.log(ele, ele?.data)
        //       // d3.select() as d3.Selection<Element, FlexNode, Element, FlexNode>
        //       // if (ele?.__data__?.data.left) {
        //       //   this.selectNode(ele)
        //       //   break
        //       // }
        //     }
        //   } else if (!im.left && pNode) {
        //     this.selectNode(pNode)
        //   }
        //   break
        // }
        // ArrowUp
        // ArrowDown
        default:
          break
      }
    } else {
      const sele = d3.select('#editing') as d3.Selection<Element, FlexNode, Element, FlexNode>
      const seleNode = sele.node()
      if (!seleNode) {
        return
      }
      // 去除输入焦点
      switch (keyName) {
        case 'Enter': {
          const editP = document.querySelector('#editing > foreignObject > div') as HTMLDivElement
          editP.setAttribute('contenteditable', 'false')
          // editP.blur()
          break
        }
        case 'Escape': {
          const editP = document.querySelector('#editing > foreignObject > div') as HTMLDivElement
          editP.setAttribute('contenteditable', 'false')
          // editP.blur()
          break
        }
        default:
          break
      }
    }
  }
  svgKeyUp() { // 针对导图的操作
    if (d3.event.key === ' ') { this.spaceKey = false }
  }
  // 节点操作
  updateNodeName() { // 文本编辑完成时
    const editP = document.querySelector('#editing > foreignObject > div') as HTMLDivElement
    // const sele = d3.select('#editing') as d3.Selection<Element, FlexNode, Element, FlexNode>
    // const seleData = sele.data()[0]
    window.getSelection()?.removeAllRanges() // 清除选中
    const editText = editP.innerText || '未命名'
    this.mindmapG.select('g#editing').each((d, i, n) => {
      (n[i] as Element).removeAttribute('id')
      const nd = this.updateName(d.data, editText)
      if (nd && editText) {
        const d = this.getSource(nd.mid)
        if (d.name) {
          this.$emit('updateNodeName', d, { dataId: nd.dataId, mid: nd.mid })
        }
      }
      // if (!editText) { // 没有值则删除
      //   const im = seleData.data
      //   this.del(im)
      // }
    })
    editP.setAttribute('contenteditable', 'false')
  }
  removeSelectedId() { // 清除选中节点
    const sele = document.getElementById('selectedNode')
    if (sele) {
      sele.setAttribute('__click__', '0')
      sele.removeAttribute('id')
    }
  }
  selectNode(n: Element) { // 选中节点
    this.removeMultiSelected()
    if (n.getAttribute('id') !== 'selectedNode') {
      this.removeSelectedId()
      n.setAttribute('id', 'selectedNode')
    }
  }
  editNode(n: Element) { // 编辑节点
    this.removeSelectedId()
    if (!n) {
      return
    }
    n.setAttribute('id', 'editing')
    const fObj = d3.select(n).selectAll('foreignObject').filter((a, b, c) => (c[b] as Element).parentNode === n) as d3.Selection<Element, FlexNode, Element, FlexNode>
    this.focusNode(fObj)
    fObj.select('div').attr('contenteditable', true)
    const fdiv = document.querySelector('#editing > foreignObject > div')
    if (fdiv) {
      window.getSelection()?.selectAllChildren(fdiv)
    }
  }
  focusNode(fObj: d3.Selection<Element, FlexNode, Element | null, FlexNode | undefined>) { // 使节点处于可视区域
    const { k } = d3.zoomTransform(this.$refs.svg) // 放大缩小倍数
    const fObjPos = (fObj.node() as Element).getBoundingClientRect()
    if (fObjPos) {
      const svgPos = this.$refs.svg.getBoundingClientRect()

      const r = fObjPos.right - svgPos.right
      const b = fObjPos.bottom - svgPos.bottom
      const l = fObjPos.left - svgPos.left
      const t = fObjPos.top - svgPos.top
      const x = (r > 0 && r) || (l < 0 && l)
      const y = (b > 0 && b) || (t < 0 && t)

      // 保持节点可视
      if (x) { this.mindmapSvg.call(this.zoom.translateBy, -x / k, 0) }
      if (y) { this.mindmapSvg.call(this.zoom.translateBy, 0, -y / k) }
    }
  }
  editNew(newD: Mdata, depth: number, pNode: Element, onlyfoc = false) { // 聚焦新节点
    // console.log(newD, depth, pNode)
    d3.transition().end().then(() => {
      const node = d3.select(pNode).selectAll(`g.node.depth_${depth}`)
        .filter((b) => (b as FlexNode).data.mid === newD.mid)
        .node()
      if (!onlyfoc) {
        this.editNode(node as Element)
      }
    }, (err) => {
      console.log(err)
    })
  }
  fdivMouseDown() {
    const flag = d3.event.target.getAttribute('contenteditable')
    if (flag === 'true') {
      d3.event.stopPropagation() // 防止触发drag、click
    }
  }
  fObjMousedown(d: FlexNode, i: number, n: ArrayLike<Element>) {
    const edit = document.getElementById('editing')
    let flag = 0
    const clickedNode = n[i].parentNode as Element
    if (edit && edit !== clickedNode) {
      const f = (
        d3.selectAll('foreignObject').filter((d, i, n) => (n[i] as Element).parentNode === edit).node() as Element
      ).firstElementChild as HTMLElement

      f.blur()
      flag = 1
    }
    if (!edit || flag) { // 未在编辑
      this.selectNode(clickedNode)
    }
  }
  fObjectClick(d: FlexNode, i: number, n: ArrayLike<Element>) { // 两次单击进入编辑状态
    const sele = document.getElementById('selectedNode')
    const { dragFlag } = this
    if (sele) {
      if (sele.getAttribute('__click__') === '1'
      && n[i].parentNode === sele
      && document.activeElement !== n[i].firstElementChild
      && !dragFlag) {
        this.editNode(sele)
        sele.setAttribute('__click__', '0')
      } else {
        sele.setAttribute('__click__', '1')
        if (!dragFlag) {
          this.$emit('click', this.getSource(d.data.mid), { dataId: d.data.dataId, mid: d.data.mid })
        }
      }
    }
  }
  fObjectRightClick(d: FlexNode, i: number, n: ArrayLike<Element>) {
    // console.log(d, i, n)
    const sele = document.getElementById('selectedNode')
    const edit = document.getElementById('editing')
    const mindmap = document.getElementById('mindmap') as HTMLElement

    const clickedNode = n[i].parentNode as Element
    const show = () => { // 显示右键菜单
      const pos = this.getViewPos()
      this.contextMenuX = (pos.left + this.menuClientWidth) > mindmap.clientWidth ? mindmap.clientWidth - this.menuClientWidth : pos.left
      this.contextMenuY = (pos.top + this.menuClientHeight) > mindmap.clientHeight ? mindmap.clientHeight - this.menuClientHeight : pos.top
      this.showContextMenu = true
      this.clearSelection()
      setTimeout(() => { this.$refs.menu.focus() }, 300)
    }
    this.contextMenuItems.valid.show = this.editable && this.valid
    this.contextMenuItems.delete.show = this.editable && this.nodeDel
    if (clickedNode.classList.contains('multiSelectedNode')) {
      const t: Mdata[] = []
      ;(this.mindmapG.selectAll('g.multiSelectedNode') as d3.Selection<Element, FlexNode, Element, FlexNode>).each((d, i, n) => { t.push(d.data) })
      const collapseFlag = t.filter((d) => d.children && d.children.length > 0).length > 0
      const expandFlag = t.filter((d) => d._children && d._children.length > 0).length > 0
      this.contextMenuTarget = t
      this.contextMenuItems.collapse.disabled = !collapseFlag
      this.contextMenuItems.expand.disabled = !expandFlag
      // this.contextMenuItems.expandNextLevel.disabled = !expandFlag
      // this.contextMenuItems.expandAll.disabled = !expandFlag
      if (this.contextMenuTarget.length === 1) {
        this.contextMenuItems.add.disabled = false
        this.contextMenuItems.copy.disabled = false
        this.contextMenuItems.paste.disabled = !this.copySource.name
        this.contextMenuItems.valid.title = this.contextMenuTarget[0].isValid === 0 ? '置为有效' : '置为无效'
      } else {
        this.contextMenuItems.add.disabled = true
        this.contextMenuItems.copy.disabled = true
        this.contextMenuItems.paste.disabled = true
        if (this.contextMenuTarget.every(i => i.isValid)) {
          this.contextMenuItems.valid.title = '置为无效'
        } else if (this.contextMenuTarget.every(i => !i.isValid)) {
          this.contextMenuItems.valid.title = '置为有效'
        } else {
          this.contextMenuItems.valid.show = false
        }
      }
      if (this.contextMenuTarget.some(i => i.dataId)) {
        this.contextMenuItems.delete.show = false
      }
      show()
    } else if (clickedNode !== edit) { // 非正在编辑
      if (clickedNode !== sele) { // 选中
        this.selectNode(clickedNode)
      }
      const { data } = d
      this.contextMenuTarget = data
      this.contextMenuItems.valid.title = data.isValid === 0 ? '置为有效' : '置为无效'
      this.contextMenuItems.add.disabled = false
      this.contextMenuItems.collapse.disabled = !(data.children && data.children.length > 0)
      this.contextMenuItems.expand.disabled = !(data._children && data._children.length > 0)
      // this.contextMenuItems.expandNextLevel.disabled = !(data._children && data._children.length > 0)
      // this.contextMenuItems.expandAll.disabled = !(data._children && data._children.length > 0)
      this.contextMenuItems.copy.disabled = false
      if (this.copySource.name) {
        this.contextMenuItems.paste.disabled = false
      }
      if (this.contextMenuTarget.dataId) {
        this.contextMenuItems.delete.show = false
      }
      show()
    }
  }
  gBtnClick(a: FlexNode, i: number, n: ArrayLike<Element>) { // 添加子节点
    if (d3.event.buttons === 2) { // 右键不响应
      return
    }
    if (this.customAdd || a.data.customAddBtn) {
      d3.event.stopPropagation()
      const d: FlexNode = d3.select(n[i].parentNode as Element).data()[0] as FlexNode
      this.mouseLeave(d, i, n)
      this.$emit('customAdd', { dataId: d.data.dataId, mid: d.data.mid })
    } else if ((n[i] as SVGElement).style.opacity === '1') {
      d3.event.stopPropagation()
      const d: FlexNode = d3.select(n[i].parentNode as Element).data()[0] as FlexNode
      const newD = this.add(d.data.mid, { name: '' })
      this.mouseLeave(d, i, n)
      if (newD) {
        // console.log(d, n[i].parentNode)
        this.editNew(newD, d.depth + 1, n[i].parentNode as Element)
      }
    }
  }
  clickMenu(key: string) {
    this.showContextMenu = false
    const { contextMenuTarget } = this
    switch (key) {
      case 'valid': {
        const isValid = this.contextMenuItems.valid.title === '置为有效' ? 1 : 0
        let targetId: string | string[]
        if (Array.isArray(this.contextMenuTarget)) {
          targetId = this.contextMenuTarget.map(i => i.mid)
          mmdata.setValid(this.contextMenuTarget.map(i => i.mid), isValid)
        } else {
          targetId = [this.contextMenuTarget.mid]
          mmdata.setValid(this.contextMenuTarget.mid, isValid)
        }
        this.$emit('valid', targetId, isValid)
        this.updateMmdata()
        break
      }
      case 'add': {
        let target: Mdata
        let sele: d3.Selection<Element, FlexNode, Element, FlexNode>
        if (Array.isArray(this.contextMenuTarget)) {
          target = this.contextMenuTarget[0]
          sele = d3.select('g.multiSelectedNode') as d3.Selection<Element, FlexNode, Element, FlexNode>
        } else {
          target = this.contextMenuTarget
          sele = d3.select('#selectedNode') as d3.Selection<Element, FlexNode, Element, FlexNode>
        }
        const seleNode = sele.node()
        if (target && seleNode) {
          const seleData = sele.data()[0]
          const newD = this.add(target.mid, { name: '' })
          if (newD) {
            this.editNew(newD, seleData.depth + 1, seleNode as Element)
          }
        }
        break
      }
      case 'delete':
        this.del(contextMenuTarget)
        break
      case 'collapse':
        this.collapse(contextMenuTarget)
        break
      case 'expand':
        this.expand(contextMenuTarget)
        break
      case 'expandNextLevel':
        this.expandAll(contextMenuTarget, 1)
        break
      case 'expandAll':
        this.expandAll(contextMenuTarget)
        break
      case 'copy': {
        let target: Mdata
        if (Array.isArray(this.contextMenuTarget)) {
          target = this.contextMenuTarget[0]
        } else {
          target = this.contextMenuTarget
        }
        this.copy(target.mid)
        break
      }
      case 'paste': {
        let target: Mdata
        if (Array.isArray(this.contextMenuTarget)) {
          target = this.contextMenuTarget[0]
        } else {
          target = this.contextMenuTarget
        }
        this.paste(target.mid)
        break
      }
      default:
        break
    }
    (this.$refs.svg as HTMLElement).focus()
    this.removeSelectedId()
  }
  // 悬浮事件
  mouseLeave(d: FlexNode, i: number, n: ArrayLike<Element>) {
    if ((n[i] as SVGElement).className.baseVal.includes('gButton')) {
      d3.select(n[i]).style('opacity', 0)
    } else {
      d3.selectAll('g.gButton').filter((a, b, c) => (c[b] as Element).parentNode === n[i].parentNode).style('opacity', 0)
    }
  }
  mouseEnter(d: FlexNode, i: number, n: ArrayLike<Element>) {
    const flag = (d.data._children?.length || 0) > 0
    if (!flag) {
      if ((n[i] as SVGElement).className.baseVal.includes('gButton')) {
        d3.select(n[i]).style('opacity', 1)
      } else {
        d3.selectAll('g.gButton').filter((a, b, c) => (c[b] as Element).parentNode === n[i].parentNode).style('opacity', 0.5)
      }
    }
  }
  // 拖拽
  draggedNodeRenew(draggedNode: Element, px: number, py: number, dura = 0, d: FlexNode) {
    const { path, renewOffset } = this
    renewOffset(d, px, py)
    const targetY = d.dy + py // x轴坐标
    const targetX = d.dx + px // y轴坐标
    const tran = d3.transition().duration(dura).ease(d3.easePoly)

    d3.select(draggedNode).transition(tran as any).attr('transform', `translate(${targetY},${targetX})`)
    // 更新draggedNode与父节点的path
    d3.select(`path#path_${d.data.mid}`).transition(tran as any).attr('d', (d) => path(d as FlexNode))
  }
  renewOffset(d: FlexNode, px: number, py: number) { // 更新偏移量
    d.px = px
    d.py = py
    if (d.children) {
      for (let index = 0; index < d.children.length; index += 1) {
        const dChild = d.children[index]
        this.renewOffset(dChild, px, py)
      }
    }
  }
  dragged(a: FlexNode, i: number, n: ArrayLike<Element>) { // 拖拽中【待完善】
    this.dragFlag = true
    if (a.depth !== 0) {
      const { mindmapG, xSpacing, foreignX, foreignY } = this
      const draggedNode = n[i].parentNode as Element
      // 拖拽，相对a原本位置的偏移
      this.draggedNodeRenew(draggedNode, d3.event.y - a.y, d3.event.x - a.x, undefined, a)
      // 鼠标的坐标（相对于this.$refs.content）
      const t = d3.mouse(this.$refs.content as SVGGElement)
      const targetY = t[0] // x轴坐标
      const targetX = t[1] // y轴坐标

      // 计算others的坐标
      ;(mindmapG.selectAll('g.node') as d3.Selection<Element, FlexNode, Element, FlexNode>)
        .filter((d, i, n) => draggedNode !== n[i] && draggedNode.parentNode !== n[i])
        .each((d, i, n) => {
          const gNode = n[i]
          const rect = { // 其他gRect的坐标，以及gRect的宽高
            y: foreignX(d) + d.y, // foreignObject的x轴偏移
            x: foreignY(d) + d.x, // foreignObject的y轴偏移
            width: d.size[1] - xSpacing,
            height: d.size[0],
          }
          // 重叠触发矩形边框
          if ((targetY > rect.y) && (targetY < rect.y + rect.width)
          && (targetX > rect.x) && (targetX < rect.x + rect.height)) {
            gNode.setAttribute('id', 'newParentNode')
          } else if (gNode.getAttribute('id') === 'newParentNode') {
            gNode.removeAttribute('id')
          }
        })
    }
  }
  dragback(d: FlexNode, draggedNode: Element) {
    this.draggedNodeRenew(draggedNode, 0, 0, 1000, d)
  }
  dragended(d: FlexNode, i: number, n: ArrayLike<Element>) {
    const { dragback, reparent, fObjectClick } = this
    const draggedNode = n[i].parentNode as Element
    const newParentNode = document.getElementById('newParentNode')
    if (newParentNode) { // 建立新的父子关系
      newParentNode.removeAttribute('id')
      const newParentD = d3.select(newParentNode).data()[0] as FlexNode
      reparent(newParentD.data, d.data)
    } else {
      const LR = (d.data.mid.split('-').length === 2) && ((d.y > 0 && d.y + d.py < 0) || (d.y < 0 && d.y + d.py > 0)) // 左右节点变换
      const flag = LR ? (a: FlexNode) => a.data.left !== d.data.left : (a: FlexNode) => a.data.left === d.data.left
      const draggedParentNode = d3.select(draggedNode.parentNode as Element)
      const draggedBrotherNodes = (draggedParentNode.selectAll(`g.depth_${d.depth}`) as d3.Selection<Element, FlexNode, Element, FlexNode>)
        .filter((a, i, n) => draggedNode !== n[i] && flag(a))
      if (!draggedBrotherNodes.nodes()[0]) { // 无兄弟节点时
        if (LR) {
          this.move(d.data)
        } else {
          dragback(d, draggedNode)
          fObjectClick(d, i, n)
        }
      } else {
        const a: { x0: number, x1: number, b1?: Mdata, n1?: Element, b0?: Mdata, n0?: Element } = { x0: Infinity, x1: -Infinity }
        draggedBrotherNodes.each((b, i, n) => {
          if (((b.x > d.x) || LR) && b.x > a.x1 && b.x < (d.x + d.px)) { // 找到新哥哥节点
            a.x1 = b.x
            a.b1 = b.data
            a.n1 = n[i]
          }
          if (((b.x < d.x) || LR) && b.x < a.x0 && b.x > (d.x + d.px)) { // 找到新弟弟节点
            a.x0 = b.x
            a.b0 = b.data
            a.n0 = n[i]
          }
        })
        if (a.b0 || a.b1) { // 存在新兄弟节点时调换节点顺序
          const sdata = d.data
          if (a.b0 && a.n0) { // 插入在兄弟节点前面
            this.move(sdata, a.b0)
            draggedNode.parentNode?.insertBefore(draggedNode, a.n0)
          } else if (a.b1 && a.n1) { // 插入在兄弟节点后面
            this.move(sdata, a.b1, 1)
            draggedNode.parentNode?.insertBefore(draggedNode, a.n1.nextSibling)
          }
        } else {
          dragback(d, draggedNode)
          fObjectClick(d, i, n)
        }
      }
    }
    this.dragFlag = false
  }
  // 多选
  removeMultiSelected() {
    try {
      (this.mindmapG.selectAll('g.multiSelectedNode') as d3.Selection<Element, FlexNode, Element, FlexNode>).each((d, i, n) => { n[i].classList.remove('multiSelectedNode') })
    } catch (error) {
      console.log('removeMultiSelected', error)
    }
  }
  multiSelectStart() { // 开始多选
    const event = d3.event
    // console.log('multiSelectStart', event)
    this.removeSelectedId()
    if (event.button === 0 && !event.ctrlKey) { // 左键
      this.removeMultiSelected()
      this.multiSeleFlag = true
      const { mouse, getViewPos } = this
      const vp = getViewPos()
      mouse.x0 = vp.left
      mouse.y0 = vp.top
    } else if (event.button === 0 && event.ctrlKey) { // ctrl + 单机，选中节点
      const d = event.target as Element
      if (d.tagName.toLocaleLowerCase() !== 'div') {
        return
      }
      const divObj = d.parentNode as Element
      const gNode = divObj.parentNode as Element
      // console.dir(gNode)
      if (!gNode.classList.contains('multiSelectedNode')) {
        gNode.classList.add('multiSelectedNode')
      } else {
        gNode.classList.remove('multiSelectedNode')
      }
    }
  }
  multiSelect() { // 多选中
    if (this.multiSeleFlag) {
      this.showSelectedBox = true
      d3.event.preventDefault()
      const { mouse, getViewPos } = this
      const vp = getViewPos()
      mouse.x1 = vp.left
      mouse.y1 = vp.top

      const { mindmapG, seleBox } = this
      ;(mindmapG.selectAll('foreignObject') as d3.Selection<Element, FlexNode, Element, FlexNode>)
        .each((d, i, n) => {
          const f = n[i]
          const g = (f.parentNode as Element)
          const pos = getViewPos(f.getBoundingClientRect())
          const flag = pos.left < seleBox.right && pos.bottom > seleBox.top && pos.right > seleBox.left && pos.top < seleBox.bottom
          if (flag) {
            g.classList.add('multiSelectedNode')
          } else {
            g.classList.remove('multiSelectedNode')
          }
        })
    }
  }
  multiSelectEnd() { // 结束多选
    this.multiSeleFlag = false
    this.showSelectedBox = false
    const { mouse } = this
    mouse.x0 = mouse.x1 = mouse.y0 = mouse.y1 = 0
  }
  // 绘制
  updateMindmap() {
    this.tree()
    this.getDTop()
    this.draw()
    this.initNodeEvent()
  }
  dKey(d: FlexNode) { return d.data.gKey }
  gClass(d: FlexNode) { return `depth_${d.depth} node` }
  gTransform(d: FlexNode) { return `translate(${d.dy},${d.dx})` }
  foreignX(d: FlexNode) {
    const { xSpacing, foreignBorderWidth } = this
    return -foreignBorderWidth + (d.data.mid !== '0' ? (d.data.left ? -d.size[1] + xSpacing : 0) : -(d.size[1] - xSpacing * 2) / 2)
  }
  foreignY(d: FlexNode) { return -this.foreignBorderWidth + (d.data.mid !== '0' ? -d.size[0] : -d.size[0] / 2) }
  gBtnTransform(d: FlexNode) {
    const { xSpacing, gBtnSide } = this
    let x = d.data.mid === '0' ? (d.size[1] - xSpacing * 2) / 2 + 8 : d.size[1] - xSpacing + 8
    if (d.data.left) {
      x = -x - gBtnSide
    }
    return `translate(${x},${-gBtnSide / 2})`
  }
  gBtnVisible(d: FlexNode) { return ((d.data._children?.length || 0) <= 0) ? 'visible' : 'hidden' }
  gEllTransform(d: FlexNode) {
    const { xSpacing } = this
    let x = d.data.mid === '0' ? (d.size[1] - xSpacing * 2) / 2 + 6 : d.size[1] - xSpacing + 6
    if (d.data.left) {
      x = -x - 16
    }
    return `translate(${x},${0})`
  }
  gEllVisible(d: FlexNode) { return (d.data._children?.length || 0) > 0 ? 'visible' : 'hidden' }
  pathId(d: FlexNode) { return `path_${d.data.mid}` }
  pathClass(d: FlexNode) { return `depth_${d.depth}` }
  pathColor(d: FlexNode) { return d.data.color || 'white' }
  path(d: FlexNode) {
    const { xSpacing, link } = this
    const temp = (d.parent && d.parent.data.mid === '0') ? -d.dy : (d.data.left ? xSpacing : -xSpacing)
    const sourceX = temp - d.py
    const sourceY = 0 - d.dx - d.px
    let textWidth = d.size[1] - xSpacing
    if (d.data.left) {
      textWidth = -textWidth
    }

    return `${link({ source: [sourceX, sourceY], target: [0, 0] })}L${textWidth},${0}`
  }
  nest(d: FlexNode, i: number, n: ArrayLike<Element>) {
    const { dKey, appendNode, updateNode, exitNode } = this
    const dd = d.children || [];
    (d3.select(n[i]).selectAll(`g${dd[0] ? `.depth_${dd[0].depth}.node` : ''}`) as d3.Selection<Element, FlexNode, Element, FlexNode>)
      .data(dd, dKey)
      .join(appendNode, updateNode, exitNode)
  }
  appendNode(enter: d3.Selection<d3.EnterElement, FlexNode, Element, FlexNode>) {
    // console.log('appendNode')
    const { expand, gEllTransform, gClass, gTransform, updateNodeName, foreignY, gBtnTransform, pathId, pathClass, pathColor, path, nest, fdivMouseDown, foreignX, gBtnSide, gBtnVisible, gEllVisible } = this
    const gNode = enter.append('g').attr('class', gClass).attr('transform', gTransform)

    const foreign = gNode.append('foreignObject').attr('x', foreignX).attr('y', foreignY)
    // https://github.com/xswei/d3-selection/blob/master/README.md#selection_append
    const foreignDiv = foreign.append('xhtml:div').attr('contenteditable', false).text((d: FlexNode) => d.data.name)
    foreignDiv.on('blur', updateNodeName).on('mousedown', fdivMouseDown)
    foreignDiv.each((d, i, n) => {
      const divEl = n[i] as HTMLElement
      const observer = new ResizeObserver((l) => {
        const t = l[0].target
        const b1 = getComputedStyle(t).borderTopWidth
        const b2 = getComputedStyle(t.parentNode as Element).borderTopWidth
        const spacing = (parseInt(b1, 10) + parseInt(b2, 10)) || 0
        foreign.filter((d: FlexNode, index: number) => i === index)
          .attr('width', l[0].contentRect.width + spacing * 2) // div和foreign border
          .attr('height', l[0].contentRect.height + spacing * 2)
      })
      observer.observe(divEl)
      if (d.data.isValid === 0) {
        // console.log(d, divEl)
        // 无效数据
        divEl.style.color = 'red'
      } else {
        divEl.style.color = ''
      }
    })

    const gBtn = gNode.append('g').attr('class', 'gButton').attr('transform', gBtnTransform).style('visibility', gBtnVisible)
    gBtn.append('rect').attr('width', gBtnSide).attr('height', gBtnSide).attr('rx', 3).attr('ry', 3)
    // gBtn.append('path').attr('d', 'M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z')
    const mg = 6 // 边距
    // 根据参数gBtnSide绘制十字
    const dPath = `M ${gBtnSide / 2} ${mg} L ${gBtnSide / 2} ${gBtnSide - mg} M ${mg} ${gBtnSide / 2} L ${gBtnSide - mg} ${gBtnSide / 2}`
    gBtn.append('path').attr('d', dPath).attr('stroke', '#8685FF')

    const ell = gNode.append('g').attr('class', 'gEllipsis').attr('transform', gEllTransform).style('visibility', gEllVisible)
      .classed('show', (d: FlexNode) => (d.data._children?.length || 0) > 0)
      .on('click', (d: FlexNode) => expand(d.data))
    ell.append('rect').attr('x', -2).attr('y', -6).attr('width', 20).attr('height', 14).style('opacity', 0)
    ell.append('rect').attr('x', 0).attr('y', -2).attr('width', 16).attr('height', 4).attr('rx', 2).attr('ry', 2).attr('class', 'btn')
      .attr('stroke', pathColor).attr('fill', pathColor)
    ell.append('circle').attr('cx', 4).attr('cy', 0).attr('r', 1)
    ell.append('circle').attr('cx', 8).attr('cy', 0).attr('r', 1)
    ell.append('circle').attr('cx', 12).attr('cy', 0).attr('r', 1)

    const enterData = enter.data()
    if (enterData.length) {
      if (enterData[0].data.mid !== '0') {
        gNode.append('path').attr('id', pathId).attr('class', pathClass).lower().attr('stroke', pathColor)
          .attr('d', path)
      }
      gNode.each(nest)
    }

    gBtn.raise()
    foreign.raise()
    return gNode
  }
  updateNode(update: d3.Selection<Element, FlexNode, Element, FlexNode>) {
    // console.log('updateNode')
    const { gEllTransform, gClass, gTransform, easePolyInOut, foreignY, gBtnTransform, pathId, pathClass, pathColor, path, nest, foreignX } = this
    update.interrupt().selectAll('*').interrupt()
    update.attr('class', gClass).transition(easePolyInOut as any).attr('transform', gTransform)

    update.each((d, k, m) => {
      const node = d3.select(m[k]) as d3.Selection<Element, FlexNode, null, undefined>
      const foreign = node.selectAll('foreignObject').filter((d, i, n) => (n[i] as Element).parentNode === m[k])
        .data([d]) // must rebind the children using selection.data to give them the new data.
        .attr('x', foreignX)
        .attr('y', foreignY)

      foreign.select('div').text(d.data.name)
      node.select('path').filter((d, i, n) => (n[i] as Element).parentNode === m[k]).attr('id', pathId(d))
        .attr('class', pathClass(d))
        .attr('stroke', pathColor(d))
        .transition(easePolyInOut as any)
        .attr('d', path(d))

      node.each(nest)

      const ellFlag = (d.data._children?.length || 0) > 0

      node.selectAll('g.gButton').filter((d, i, n) => (n[i] as Element).parentNode === m[k]).data([d])
        .attr('transform', gBtnTransform)
        .style('visibility', !ellFlag ? 'visible' : 'hidden')
        .raise()

      const ell = node.selectAll('g.gEllipsis').filter((d, i, n) => (n[i] as Element).parentNode === m[k]).data([d])
        .attr('transform', gEllTransform)
        .classed('show', ellFlag)
        .style('visibility', ellFlag ? 'visible' : 'hidden')
      ell.select('rect.btn').attr('stroke', pathColor).attr('fill', pathColor)

      foreign.raise()
    })
    return update
  }
  exitNode(exit: d3.Selection<Element, FlexNode, Element, FlexNode>) {
    try {
      exit.filter((d, i, n) => n[i].classList[1] === 'node').remove()
    } catch (error) {
      console.log(error)
    }
  }
  draw() { // 生成svg
    const { dKey, mindmapG, appendNode, updateNode, exitNode } = this
    const d = [this.root]
    ;(mindmapG.selectAll(`g${d[0] ? `.depth_${d[0].depth}.node` : ''}`) as d3.Selection<Element, FlexNode, Element, FlexNode>)
      .data(d, dKey)
      .join(appendNode, updateNode, exitNode)
    mindmapG.selectAll('foreignObject > div').each((d, i, n) => {
      const divEl = n[i] as HTMLElement
      if ((d as FlexNode).data.isValid === 0) {
        divEl.style.color = 'red'
      } else {
        divEl.style.color = ''
      }
    })
  }
  tree() { // 数据处理
    const { ySpacing } = this
    const layout = flextree({ spacing: ySpacing })
    const yGap = mmdata.data.size[1] / 2
    // left
    const tl = layout.hierarchy(mmdata.data, (d: Mdata) => d.mid.split('-').length === 1 ? d.children?.filter(d => d.left) : d.children)
    layout(tl)
    tl.each((a: FlexNode) => { if (a.data.mid !== '0') { a.y = -a.y + yGap } })
    // right
    const tr = layout.hierarchy(mmdata.data, (d: Mdata) => d.mid.split('-').length === 1 ? d.children?.filter(d => !d.left) : d.children)
    layout(tr)
    tr.each((a: FlexNode) => { if (a.data.mid !== '0') { a.y = a.y - yGap } }) // 往同个方向移动固定距离
    // all
    tr.children = tl.children
      ? (tr.children ? tr.children.concat(tl.children) : tl.children)
      : tr.children
    tr.each((a: FlexNode) => { // x纵轴 y横轴 dx dy相对偏移
      if (a.data.mid !== '0') {
        a.x += a.size[0] / 2
      }
      a.dx = a.x - (a.parent ? a.parent.x : 0)
      a.dy = a.y - (a.parent ? a.parent.y : 0)
      a.px = 0
      a.py = 0
    })
    this.root = tr
  }
  getDTop() {
    let t = this.root
    while (t.children) { t = t.children[0] }
    this.dTop = t
  }
  getSize(text: string, root = false) {
    try {
      const { dummy, xSpacing, minTextWidth, minTextHeight } = this
      let textWidth = 0
      let textHeight = 0
      dummy.selectAll('.dummyText').data([text]).enter().append('div').text((d) => d)
        .each((d, i, n) => {
          textWidth = n[i].offsetWidth
          textHeight = n[i].offsetHeight
          n[i].remove() // remove them just after displaying them
        })
      textWidth = Math.max(minTextWidth, textWidth)
      textHeight = Math.max(minTextHeight, textHeight)
      return [textHeight, textWidth + (root ? xSpacing * 2 : xSpacing)]
    } catch (error) {
      console.log(error)
    }
  }
  clearSelection() { // 清除右键触发的选中单词
    if (window.getSelection) {
      const sel = window.getSelection()
      sel?.removeAllRanges()
    }
  }
  addWatch() {
    this.$watch('value', (newVal) => {
      if (this.toUpdate) {
        mmdata = new ImData(newVal[0], this.getSize)
        this.updateMmdata()
      } else {
        this.toUpdate = true
      }
    }, { immediate: true, deep: true })
  }
  async mounted() {
    this.init()
    this.mindmapSvg.on('mousedown', this.multiSelectStart)
    this.mindmapSvg.on('mousemove', this.multiSelect)
    this.mindmapSvg.on('mouseup', this.multiSelectEnd)
    this.addWatch()
    await this.fitContent()
    await this.makeCenter()
    this.mindmapG.style('opacity', 1)
  }
}
</script>

<style lang="scss">
  @import '../css/MindMap.scss';
  #mindmap {
    position: relative;
    foreignObject > div.focus[contenteditable='false'] {
      background-color: #c60e11;
      color: #ffffff !important;
    }
  }
  .search-input {
    position: absolute;
    width: 150px;
    height: 32px;
    line-height: 32px;
    left: 10px;
    top: 10px;
    background-color: #ffffff;
    border: 1px solid #dddddd;
    border-radius: 5px;
    padding: 0 8px;
    outline: none;
    &:hover, &:focus, &:active, &:focus-visible {
      outline: none;
    }
    &::placeholder {
      height: 32px;
      line-height: 32px;
      font-size: 12px;
    }
  }
  #expandLevel {
    position: absolute;
    width: 150px;
    height: 32px;
    line-height: 32px;
    left: 10px;
    top: 52px;
    background-color: #ffffff;
    border: 1px solid #dddddd;
    border-radius: 5px;
    padding: 0 8px;
    outline: none;
    text-align: center;
  }
</style>
