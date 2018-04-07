import test from 'ava'
import {
    createTemplate,
    createComponent,
    createInstance,
    createContext,
} from '../src/index'

test('createTemplate() fills in default values', t => {
    const tpl = createTemplate({})
    t.deepEqual([], tpl.sockets)
    t.deepEqual({}, tpl.actions)
    t.deepEqual({}, tpl.children)
    t.truthy(typeof tpl.render === 'function')
})

test('createComponent() throws if paths dont cover all Template sockets', t => {
    const template = createTemplate({
        sockets: ['name', 'age', 'email'],
    })

    const err = t.throws(() => {
        const component = createComponent(template, {
            name: ['name'],
        })
    })

    t.is(err.message, `Component paths don't cover sockets: age, email`)
})

test('createComponent() calculates signature from Template and paths', t => {
    const template = createTemplate({
        sockets: ['name', 'age'],
    })

    const component1 = createComponent(template, {
        name: ['one', 'name'],
        age: ['one', 'age'],
    })

    const component2 = createComponent(template, {
        name: ['two', 'name'],
        age: ['two', 'age'],
    })

    t.truthy(typeof component1.signature === 'string')
    t.truthy(component1.signature.length === 40)

    t.truthy(typeof component2.signature === 'string')
    t.truthy(component2.signature.length === 40)

    t.truthy(component1.signature !== component2.signature)
})

test('createComponent() adds $local field to paths', t => {
    const template = createTemplate({
        sockets: ['name'],
    })
    const component = createComponent(template, {
        name: ['name'],
    })

    t.deepEqual(component.paths, {
        $local: ['$local', component.signature],
        name: ['name'],
    })
})

test('createInstance() calls context.createInstance()', t => {
    const template = createTemplate({
        render: () => 'content',
    })

    const component = createComponent(template, {})

    const context = createContext({})

    const instance = createInstance(context, component)

    t.is(instance(), 'content')
})
