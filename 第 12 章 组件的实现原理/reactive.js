/**
 * **************************************
 * 版本：V1.0
 * **************************************
 */

let activeEffect
let shouldTrack = true
const effectStack = []
const bucket = new WeakMap()
const ITERATE_KEY = Symbol()
const TriggerType = {
    ADD: 'ADD',
    SET: 'SET',
    DELETE: 'DELETE'
}
const reactiveMap = new Map()
const arrayInstrumentations = function () {
    const methods = {}
    ;['includes', 'indexOf', 'lastIndexOf'].forEach(method => {
        const originMethod = Array.prototype[method]
        methods[method] = function (...args) {
            let res = originMethod.apply(this, args)
            if (res === false || res === -1) {
                res = originMethod.apply(this['raw'], args)
            }
            return res
        }
    })
    ;['push', 'pop', 'shift', 'unshift', 'splice'].forEach(method => {
        const originMethod = Array.prototype[method]
        methods[method] = function (...args) {
            shouldTrack = false
            const res = originMethod.apply(this, args)
            shouldTrack = true
            return res
        }
    })
    return methods
}()

function createReactive(obj, isShallow = false, isReadonly = false) {
    return new Proxy(obj, {
        get(target, key, receiver) {
            if (key === 'raw') return target
            if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) return Reflect.get(arrayInstrumentations, key, receiver)
            const res = Reflect.get(target, key, receiver)
            if (!isReadonly && typeof key !== 'symbol') {
                track(target, key)
            }
            if (isShallow) return res
            if (typeof res === 'object' && res !== null) return isReadonly ? readonly(res) : reactive(res)
            return res
        },
        set(target, key, newVal, receiver) {
            if (isReadonly) return true
            const oldValue = target[key]
            const type = Array.isArray(target) ? Number(key) < target.length ? TriggerType.SET : TriggerType.ADD : Object.prototype.hasOwnProperty.call(target, key) ? TriggerType.SET : TriggerType.ADD
            const res = Reflect.set(target, key, newVal, receiver)
            if (receiver['raw'] === target) {
                if (oldValue !== newVal && (oldValue === oldValue || newVal === newVal)) {
                    trigger(target, key, type, newVal)
                }
            }
            return res
        },
        has(target, key) {
            track(target, key)
            return Reflect.has(target, key)
        },
        ownKeys(target) {
            track(target, Array.isArray(target) ? 'length' : ITERATE_KEY)
            return Reflect.ownKeys(target)
        },
        deleteProperty(target, key) {
            if (isReadonly) return true
            const hadKey = Object.prototype.hasOwnProperty.call(target, key)
            const res = Reflect.deleteProperty(target, key)
            if (hadKey && res) {
                trigger(target, key, TriggerType.DELETE)
            }
            return res
        }
    })
}

function reactive(obj) {
    const existionProxy = reactiveMap.get(obj)
    if (existionProxy) return existionProxy
    const proxy = createReactive(obj)
    reactiveMap.set(obj, proxy)
    return proxy
}

function ref(value) {
    const wrapper = {
        value
    }
    Object.defineProperty(wrapper, '__v_isRef', {
        value: true
    })
    return reactive(wrapper)
}

function shallowReactive(obj) {
    return createReactive(obj, true)
}

function readonly(obj) {
    return createReactive(obj, false, true)
}

function shallowReadonly(obj) {
    return createReactive(obj, true, true)
}

function toRef(obj, key) {
    const wrapper = {
        get value() {
            return obj[key]
        },
        set value(val) {
            obj[key] = val
        }
    }
    Object.defineProperty(wrapper, '__v_isRef', {
        value: true
    })
    return wrapper
}

function toRefs(obj) {
    const ret = {}
    for (const key in obj) {
        ret[key] = toRef(obj, key)
    }
    return ret
}

function proxyRefs(obj) {
    return new Proxy(obj, {
        get(target, key, receiver) {
            const value = Reflect.get(target, key, receiver)
            return value.__v_isRef ? value.value : value
        },
        set(target, key, newValue, receiver) {
            const value = target[key]
            if (value.__v_isRef) {
                value.value = newValue
                return true
            }
            return Reflect.set(target, key, newValue, receiver)
        }
    })
}

function track(target, key) {
    if (!activeEffect || !shouldTrack) return
    let depsMap = bucket.get(target)
    if (!depsMap) {
        depsMap = new Map()
        bucket.set(target, depsMap)
    }
    let deps = depsMap.get(key)
    if (!deps) {
        deps = new Set()
        depsMap.set(key, deps)
    }
    deps.add(activeEffect)
    activeEffect.deps.push(deps)
    console.log(`收集副作用函数：`, key)
}

function trigger(target, key, type, newVal) {
    const depsMap = bucket.get(target)
    if (!depsMap) return
    const effects = depsMap.get(key)
    const effectsToRun = new Set()
    effects && effects.forEach(effectFn => {
        if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
        }
    })
    if (type === TriggerType.ADD || type === TriggerType.DELETE) {
        const iterateEffects = depsMap.get(ITERATE_KEY)
        iterateEffects && iterateEffects.forEach(effectFn => {
            if (effectFn !== activeEffect) {
                effectsToRun.add(effectFn)
            }
        })
    }
    if (type === TriggerType.ADD && Array.isArray(target)) {
        const lengthEffects = depsMap.get('length')
        lengthEffects && lengthEffects.forEach(effectFn => {
            if (effectFn !== activeEffect) {
                effectsToRun.add(effectFn)
            }
        })
    }
    if (Array.isArray(target) && key === 'length') {
        depsMap.forEach((effects, key) => {
            if (key >= newVal) {
                effects.forEach(effectFn => {
                    if (effectFn !== activeEffect) {
                        effectsToRun.add(effectFn)
                    }
                })
            }
        })
    }
    effectsToRun.forEach(effectFn => {
        if (effectFn.options.scheduler) {
            effectFn.options.scheduler(() => effectFn(key))
        } else {
            effectFn(key)
        }
    })
    effectsToRun.size && console.log(`触发更新：`, key)
}

function cleanup(effectFn) {
    for (let i = 0; i < effectFn.deps.length; i++) {
        const deps = effectFn.deps[i]
        deps.delete(effectFn)
    }
    effectFn.deps.length = 0
}

function effect(fn, options = {}) {
    const effectFn = (key) => {
        cleanup(effectFn)
        activeEffect = effectFn
        effectStack.push(effectFn)
        const res = fn(key)
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
        return res
    }
    effectFn.options = options
    effectFn.deps = []
    if (options.lazy) return effectFn
    effectFn()
}

function traverse(value, seen = new Set()) {
    if (typeof value !== 'object' || value === null || seen.has(value)) return
    seen.add(value)
    for (const key in value) {
        traverse(value[key], seen)
    }
    return value
}

function watch(source, cb, options = {}) {
    let getter
    if (typeof source === 'function') {
        getter = source
    } else {
        getter = () => traverse(source)
    }

    let oldValue, newValue
    const job = () => {
        newValue = effectFn()
        cb(newValue, oldValue)
        oldValue = newValue
    }
    const effectFn = effect(() => getter(), {
        lazy: true,
        scheduler: () => {
            if (options.flush === 'post') {
                Promise.resolve().then(job)
            } else {
                job()
            }
        }
    })
    if (options.immediate) {
        job()
    } else {
        oldValue = effectFn()
    }
}
