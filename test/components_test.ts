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

    t.deepEqual({ name: 'John', age: 21 }, instance())
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
