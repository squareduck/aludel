import test from 'ava'
import {
    createTemplate,
    createComponent,
    createInstance,
    createContext,
} from '../src/index'

test('createComponent() throws error if paths does not match Template sockets', t => {
    const template = createTemplate({
        sockets: ['name', 'age'],
    })

    createComponent(template, {
        name: ['this', 'matches'],
        age: ['this', 'also', 'matches'],
    })

    t.throws(() => {
        createComponent(template, {
            name: ['this', 'matches'],
            city: ['this', 'does', 'not'],
        })
    })
})

test('Instance returns result of Template render function', t => {
    const template = createTemplate({
        render: () => {
            return 'content'
        },
    })

    const component = createComponent(template, {})

    const appContext = createContext({})

    const instance = createInstance(appContext, component)

    t.is('content', instance())
})

test('createComponent gives component unique signature (same template and paths = same signature)', t => {
    const firstTemplate = createTemplate({
        sockets: ['one'],
    })

    const secondTemplate = createTemplate({
        sockets: ['two'],
    })

    const firstComponent = createComponent(firstTemplate, { one: ['one'] })
    const secondComponent = createComponent(firstTemplate, { one: ['first'] })
    const thirdComponent = createComponent(secondTemplate, { two: ['two'] })
    const fourthComponent = createComponent(firstTemplate, { one: ['one'] })

    t.not(firstComponent.signature, secondComponent.signature)
    t.not(firstComponent.signature, thirdComponent.signature)
    t.is(firstComponent.signature, fourthComponent.signature)
})

test('Instance can read local model defined by sockets and paths', t => {
    const template = createTemplate({
        sockets: ['name', 'age'],
        render: ({ model }) => {
            return model
        },
    })

    const component = createComponent(template, {
        name: ['person', 'name'],
        age: ['person', 'age'],
    })

    const initialState = {
        person: {
            name: 'John',
            age: 21,
        },
    }

    const appContext = createContext(initialState)

    const instance = createInstance(appContext, component)

    t.deepEqual({ $local: undefined, name: 'John', age: 21 }, instance())
})

test.cb(
    'New local model returned from action is applied back to global state',
    t => {
        let connectedAction
        const template = createTemplate({
            sockets: ['counter'],
            actions: {
                increment: count => model => {
                    model.counter += count
                    return model
                },
            },
            render: ({ model, action }) => {
                connectedAction = action.increment
                return model.counter
            },
        })

        const component = createComponent(template, {
            counter: ['counter'],
        })

        let renderCount = 0
        let expectedValues = [10, 20, 30]
        const context = createContext({ counter: 0 }, state => {
            t.is(expectedValues[renderCount], state.counter)
            renderCount += 1
            renderCount === 3 || t.end()
        })

        const instance = createInstance(context, component)

        t.is(0, instance())

        connectedAction(10)
        connectedAction(10)
        connectedAction(10)
    },
)

test.cb('Action can return a Promise of model', t => {
    let connectedAction
    const template = createTemplate({
        sockets: ['counter'],
        actions: {
            asyncIncrement: amount => model => {
                return Promise.resolve(model.counter)
                    .then(counter => counter + amount)
                    .then(counter => {
                        model.counter = counter
                        return model
                    })
            },
        },
        render: ({ model, action }) => {
            connectedAction = action.asyncIncrement
            return model.counter
        },
    })

    const component = createComponent(template, {
        counter: ['counter'],
    })

    let renderCount = 0
    let expectedValues = [50, 100, 150]
    const context = createContext({ counter: 0 }, state => {
        t.is(expectedValues[renderCount], state.counter)
        renderCount += 1
        renderCount === 3 || t.end()
    })

    const instance = createInstance(context, component)

    instance()

    connectedAction(50)
    connectedAction(50)
    connectedAction(50)
})

test.cb('Components have access to per-component local state', t => {
    let connectedAction
    const template = createTemplate({
        actions: {
            setMessage: message => model => {
                model.$local = message
                return model
            },
        },
        render: ({ model, action }) => {
            connectedAction = action.setMessage
            return model.$local
        },
    })

    const component = createComponent(template, {})

    const context = createContext({}, state => {
        t.is('Hello', state.$local[component.signature])
        t.is('Hello', instance())
        t.end()
    })

    const instance = createInstance(context, component)

    instance()

    connectedAction('Hello')
})

test.cb('Component triggers $init action on instantiation', t => {
    const template = createTemplate({
        sockets: ['counter'],
        actions: {
            $init: () => model => {
                model.counter = 21
                return model
            },
        },
        render: ({ model }) => {
            return model.counter
        },
    })

    const component = createComponent(template, {
        counter: ['data', 'counter'],
    })

    const context = createContext({}, state => {
        t.is(21, state.data.counter)
        t.is(21, instance())
        t.end()
    })

    const instance = createInstance(context, component)
})

test('Components can declare child components and pass props to them', t => {
    const childTemplate = createTemplate({
        render: ({ props }) => {
            return 'Child ' + props.name
        },
    })

    const childComponent = createComponent(childTemplate, {})

    const parentTemplate = createTemplate({
        sockets: ['people'],
        children: {
            person: childComponent,
        },
        render: ({ model, child }) => {
            return model.people.map(person => child.person({ name: person }))
        },
    })

    const parentComponent = createComponent(parentTemplate, {
        people: ['people'],
    })

    const context = createContext({ people: ['Ash', 'Bob', 'Cid'] })

    const instance = createInstance(context, parentComponent)

    t.deepEqual(['Child Ash', 'Child Bob', 'Child Cid'], instance())
})

test.cb('Parent component redraws after Actions in Children', t => {
    let connectedAction
    const childTemplate = createTemplate({
        actions: {
            $init: () => model => {
                model.$local = { counter: 0 }
                return model
            },
            increment: () => model => {
                model.$local.counter += 1
                return model
            },
        },
        render: ({ model, action }) => {
            connectedAction = action.increment
            return model.$local.counter
        },
    })
    const childComponent = createComponent(childTemplate, {})

    const parentTemplate = createTemplate({
        children: {
            counter: childComponent,
        },
        render: ({ child }) => {
            return child.counter() + '!'
        },
    })
    const parentComponent = createComponent(parentTemplate, {})

    let renderCount = 0
    const context = createContext({}, state => {
        renderCount += 1
        if (renderCount === 1) {
            t.is('0!', parentInstance())
            connectedAction()
        }
        if (renderCount === 2) {
            t.is('1!', parentInstance())
            t.end()
        }
    })

    const parentInstance = createInstance(context, parentComponent)
})
