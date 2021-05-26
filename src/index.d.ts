interface Data {
  name: string
  children?: Array<Data>
  _children?: Array<Data>
  collapse?: boolean
  customAddBtn?: boolean // 自定义点击gBtn事件
  left?: boolean
}

interface Mdata {
  name: string
  mid: string
  color: string
  gKey: number
  size: number[]
  children?: Array<Mdata>
  _children?: Array<Mdata>
  collapse?: boolean
  customAddBtn?: boolean // 自定义点击gBtn事件
  left: boolean
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
