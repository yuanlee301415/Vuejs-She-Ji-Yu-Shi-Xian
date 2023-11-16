/**
 * 与当前 key 相关联的副作用函数
 */
interface Deps extends Set<Function> {}

/**
 *  存储副作用函数的桶
 */
interface Bucket extends WeakMap<object, Map<string, Deps>> {}

/**
 * 副作用函数包装函数
 */
interface EffectFn {
    /**
     * @param key - 副作用函数关联 key
     */
    (key?: string): void

    /**
     * 存储所有与该副作用函数相关联的依赖集合
     */
    deps: Deps[]

    /**
     * 副作用函数选项
     */
    options?: EffectOptions
}


/**
 * 副作用函数栈
 */
type EffectStack = EffectFn[]

/**
 * 副作用函数选项
 */
type EffectOptions = {
    /**
     * 调度器
     */
    scheduler?: Function,

    /**
     * 是否延迟执行
     */
    lazy?: boolean
}

/**
 * 组件
 */
interface Component {
    name?: string
    data?(): object
    render?(): VNode
    beforeCreate?(): void
    created?(): void
    beforeMount?(): void
    mounted?(): void
    beforeUpdate?(): void
    updated?(): void
    props?: object
    setup?(): object | Function
}

/**
 * 虚拟节点
 */
interface VNode {
    /**
     * HTML 元素名
     */
    type: string | Component

    /**
     * 子节点（或列表）
     */
    children: string | VNode[]

    /**
     * 关联的真实 DOM
     */
    el?: HTMLElement

    /**
     * DOM 属性 或 组件 props 数据
     */
    props?: object

    component?: Component
}

/**
 * 渲染器配置
 */
interface RendererOptions {
    /**
     * 创建 HTML 元素
     * @param tag - HTML 标签名
     */
    createElement(tag: string): HTMLElement

    /**
     * 设置 HTML 元素文本内容
     * @param el - HTML 元素
     * @param text - 文本内容
     */
    setElementText(el: HTMLElement, text: string): void

    /**
     * 插入 HTML 元素
     * @param el - 待插入的 HTML 元素
     * @param parent - 待插入的父 HTML 元素
     * @param anchor - 将要插在这个节点之前
     */
    insert(el: HTMLElement, parent: HTMLElement, anchor?: HTMLElement): void

    /**
     * 指定的 DOM 属性是否可设置（非只读）
     * @param el
     * @param key - DOM 属性名
     * @param prevValue - 旧的属性值
     * @param nextValue - 新的属性值
     */
    patchProps(el: HTMLElement, key: string, prevValue: any, nextValue: any): boolean
}

/**
 * 容器
 */
interface Container extends HTMLElement {
    /**
     * 当前已经挂载的 vnode
     */
    _vnode: VNode
}
