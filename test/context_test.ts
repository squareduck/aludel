import test from 'ava'
import {
    createTemplate,
    createComponent,
    createInstance,
    createContext,
} from '../src/index'

test.cb('createContext() calls onUpdate() after each action', t => {
    const context = createContext({}, (state, action) => {
        if (action.source === 'Context' && action.name === 'triggerUpdate')
            t.end()
    })

    context.triggerUpdate()
})

test('localModel() derives values from Global State using paths', t => {
    const context = createContext({
        person: {
            name: 'John',
            age: 21,
            hobbies: ['music', 'books'],
        },
    })

    const model = context.localModel({
        name: ['person', 'name'],
        mainHobby: ['person', 'hobbies', 0],
        email: ['person', 'email'],
    })

    t.deepEqual(model, {
        name: 'John',
        mainHobby: 'music',
        email: undefined,
    })
})

test('localModel() applies defaults if property is not set', t => {
    const context = createContext({
        person: {
            name: 'John',
        },
    })

    const model = context.localModel(
        {
            name: ['person', 'name'],
            age: ['person', 'age'],
        },
        {
            name: 'Ash',
            age: 21,
        },
    )

    t.deepEqual(model, {
        name: 'John',
        age: 21,
    })
})

test.cb('connectActions() returns actions that update Global State', t => {
    const initialState = {
        counter: 0,
    }

    const context = createContext(initialState, (state, action) => {
        if (action.source === 'Test' && action.name === 'increment') {
            t.is(state.counter, 5)
            t.end()
        } else {
            t.fail(`Got unexpected action ${action}`)
        }
    })

    const actions = {
        increment: amount => model => {
            model.counter += amount
            return model
        },
    }

    const paths = {
        counter: ['counter'],
    }

    const connectedActions = context.connectActions(paths, {}, actions, 'Test')

    connectedActions.increment(5)
})

test.cb('connectActions() allows actions to return partial Model', t => {
    const initialState = {
        person: {
            name: 'John',
            age: 21,
        },
    }

    const context = createContext(initialState, (state, action) => {
        if (action.source === 'Test' && action.name === 'growUp') {
            t.is(state.person.name, 'John')
            t.is(state.person.age, 24)
            t.end()
        } else {
            t.fail(`Got unexpected action ${action}`)
        }
    })

    const actions = {
        growUp: years => model => {
            return {
                age: model.age + years,
            }
        },
    }

    const paths = {
        name: ['person', 'name'],
        age: ['person', 'age'],
    }

    const connectedActions = context.connectActions(paths, {}, actions, 'Test')

    connectedActions.growUp(3)
})

test.cb('connectActions() allows actions to return a Promise of model', t => {
    const initialState = {
        counter: 0,
        asyncCounter: 0,
    }

    const expectedActions = [
        { source: 'Test', name: 'increment' },
        { source: 'Test', name: 'asyncIncrement' },
    ]
    const expectedStates = [
        { counter: 5, asyncCounter: 0 },
        { counter: 5, asyncCounter: 5 },
    ]

    let updateCount = 0
    const context = createContext(initialState, (state, action) => {
        updateCount += 1
        t.deepEqual(expectedActions[updateCount - 1], action)
        t.deepEqual(expectedStates[updateCount - 1], state)
        if (updateCount === 2) t.end()
    })

    const actions = {
        increment: amount => model => {
            model.counter += amount
            return model
        },
        asyncIncrement: amount => model => {
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve({ asyncCounter: model.asyncCounter + amount })
                }, 10)
            })
        },
    }

    const paths = {
        counter: ['counter'],
        asyncCounter: ['asyncCounter'],
    }

    const connectedActions = context.connectActions(paths, {}, actions, 'Test')

    connectedActions.increment(5)
    connectedActions.asyncIncrement(5)
})

test.cb('connectActions() respects default values', t => {
    const initialState = {
        person: {
            name: 'John',
        },
    }

    const paths = {
        name: ['person', 'name'],
        age: ['person', 'age'],
    }

    const actions = {
        growUp: years => model => {
            model.age += years
            return model
        },
    }

    const defaults = {
        name: 'John',
        age: 21,
    }

    const context = createContext(initialState, (state, action) => {
        t.is(state.person.name, 'John')
        t.is(state.person.age, 26)
        t.is(action.source, 'PersonActions')
        t.end()
    })

    const connectedActions = context.connectActions(
        paths,
        defaults,
        actions,
        'PersonActions',
    )

    connectedActions.growUp(5)
})

test('createInstance() returns wrapped render() of Component', t => {
    const template = createTemplate({
        render: () => 'content',
    })

    const component = createComponent({ template })

    const context = createContext({})

    const instance = context.createInstance(component)

    t.is(instance(), 'content')
})

test('createInstance() passes Local Model to render()', t => {
    const template = createTemplate({
        sockets: ['name'],
        render: ({ model }) => model.name,
    })

    const component = createComponent({
        template,
        paths: {
            name: ['person', 'name'],
        },
    })

    const initialState = {
        person: {
            name: 'John',
        },
    }
    const context = createContext(initialState)

    const instance = context.createInstance(component)

    t.is(instance(), 'John')
})

test('createInstance() uses component defaults for Local Model', t => {
    const template = createTemplate({
        sockets: ['name', 'age'],
        render: ({ model }) => model,
    })

    const component = createComponent({
        template,
        paths: {
            name: ['person', 'name'],
            age: ['person', 'age'],
        },
        defaults: {
            $local: {},
            name: 'John',
            age: 21,
        },
    })

    const context = createContext({})

    const instance = context.createInstance(component)

    t.deepEqual(instance(), {
        $local: {},
        name: 'John',
        age: 21,
    })
})

test.cb('createInstance() passes connected Actions to render()', t => {
    const template = createTemplate({
        actions: {
            pass: () => model => {
                t.end()
                return model
            },
        },
        render: ({ action }) => {
            action.pass()
        },
    })

    const component = createComponent({ template })

    const context = createContext({})

    const instance = context.createInstance(component)

    instance()
})

test('createInstance() passes instances of child Components to render()', t => {
    const childTemplate = createTemplate({
        sockets: ['name'],
        render: ({ model }) => model.name,
    })

    const firstChildComponent = createComponent({
        template: childTemplate,
        paths: {
            name: ['child', 0, 'name'],
        },
    })

    const secondChildComponent = createComponent({
        template: childTemplate,
        paths: {
            name: ['child', 1, 'name'],
        },
    })

    const parentTemplate = createTemplate({
        children: {
            first: firstChildComponent,
            second: secondChildComponent,
        },
        render: ({ child }) => `${child.first()} ${child.second()}`,
    })

    const parentComponent = createComponent({ template: parentTemplate })

    const initialState = {
        child: [{ name: 'Ash' }, { name: 'Bob' }],
    }

    const context = createContext(initialState)

    const instance = context.createInstance(parentComponent)

    t.is(instance(), 'Ash Bob')
})

test('createInstance() passes props to render()', t => {
    const template = createTemplate({
        render: ({ props }) => `${props.name} ${props.age}`,
    })

    const component = createComponent({ template })

    const context = createContext({})

    const instance = context.createInstance(component)

    t.is(instance({ name: 'John', age: 21 }), 'John 21')
})

test('createInstance() passes itself as create() to render()', t => {
    const mainTemplate = createTemplate({
        render: ({ create }) => {
            const dynamicTemplate = createTemplate({
                render: () => 'dynamic',
            })

            const dynamicComponent = createComponent({
                template: dynamicTemplate,
            })

            const dynamicInstance = create(dynamicComponent)

            return `static ${dynamicInstance()}`
        },
    })

    const mainComponent = createComponent({ template: mainTemplate })

    const context = createContext({})

    const mainInstance = context.createInstance(mainComponent)

    t.is(mainInstance(), 'static dynamic')
})
test('createInstance() passes outlet to render()', t => {
    const innerTemplate = createTemplate({
        render: () => 'inner',
    })

    const innerComponent = createComponent({ template: innerTemplate })

    const outerTemplate = createTemplate({
        render: ({ outlet }) => {
            return `outer ${outlet()}`
        },
    })

    const outerComponent = createComponent({ template: outerTemplate })

    const context = createContext({})

    const innerInstance = context.createInstance(innerComponent)

    const outerInstance = context.createInstance(outerComponent)

    t.is(outerInstance({}, innerInstance), 'outer inner')
})
test('createInstance() passes tools to render()', t => {
    const template = createTemplate({
        render: ({ navigate, link }) => {
            t.is(link.Home(), 'link')
            return navigate.Home()
        },
    })

    const component = createComponent({ template })

    const context = createContext({})

    const navigate = {
        Home: () => 'navigate',
    }

    const link = {
        Home: () => 'link',
    }

    const instance = context.createInstance(component, { navigate, link })
    t.is(instance(), 'navigate')
})

test.cb('createInstance() calls $init action of Component', t => {
    const template = createTemplate({
        sockets: ['counter'],
        actions: {
            $init: () => model => {
                model.counter = 5
                return model
            },
        },
    })

    const component = createComponent({
        name: 'MyComponent',
        template,
        paths: {
            counter: ['counter'],
        },
    })

    const context = createContext({ counter: 0 }, (state, action) => {
        if (
            action.source.startsWith('MyComponent') &&
            action.name === '$init'
        ) {
            t.is(state.counter, 5)
            t.end()
        }
    })

    context.createInstance(component)
})

test.cb('createInstance() caches Instances', t => {
    const template = createTemplate({
        sockets: ['counter'],
        actions: {
            $init: () => model => {
                model.counter += 5
                return model
            },
        },
    })

    const component = createComponent({
        template,
        paths: {
            counter: ['counter'],
        },
    })

    const context = createContext({ counter: 0 }, (state, action) => {
        if (action.source === component.signature && action.name === '$init') {
            t.is(state.counter, 5)
        }
        if (action.source === 'Context' && action.name === 'triggerUpdate') {
            t.end()
        }
    })

    context.createInstance(component)
    context.createInstance(component)
    context.triggerUpdate()
})
