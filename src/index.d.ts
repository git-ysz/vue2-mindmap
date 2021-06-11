interface Data {
  name: string
  dataId?: number // 数据id（后端接口传回）
  children?: Array<Data>
  _children?: Array<Data>
  collapse?: boolean
  left?: boolean
  isValid?: number
}

interface Mdata {
  name: string
  dataId?: number
  mid: string
  color: string
  gKey: number
  size: number[]
  children?: Array<Mdata>
  _children?: Array<Mdata>
  collapse?: boolean
  customAddBtn?: boolean // 自定义点击gBtn事件
  left: boolean
  isValid?: number
}

interface FlexNode {
  children: FlexNode[]
  data: Mdata
  depth: number
  dx: number
  dy: number
  height: number
  length: number
  parent: FlexNode | null
  x: number
  y: number
  each: Function
  size: number[]
  px: number
  py: number
}
