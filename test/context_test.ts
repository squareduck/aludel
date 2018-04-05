import test from 'ava'
import {
    createTemplate,
    createComponent,
    createInstance,
    createContext,
} from '../src/index'

test('Local model can resolve any paths in state', t => {
    const context = createContext({
        person: {
            name: 'John',
            age: 21,
            hobbies: ['music', 'poetry'],
        },
    })

    const localModel = context.localModel({
        name: ['person', 'name'],
        hobby: ['person', 'hobbies', 0],
        hobbies: ['person', 'hobbies'],
        city: ['person', 'city'],
        phone: ['details', 'contacts', 'phone'],
    })

    t.deepEqual(
        {
            name: 'John',
            hobby: 'music',
            hobbies: ['music', 'poetry'],
            city: undefined,
            phone: undefined,
        },
        localModel,
    )
})

test.cb('Connected action can return partial model', t => {
    const initialModel = {
        user: {
            name: 'John',
            age: 21,
        },
    }

    const context = createContext(initialModel, state => {
        t.is('Ash', state.user.name)
        t.is(21, state.user.age)
        t.end()
    })

    const actions = {
        setName: name => model => ({ name }),
    }

    const connectedActions = context.connectActions(
        {
            name: ['user', 'name'],
            age: ['user', 'age'],
        },
        actions,
    )

    connectedActions.setName('Ash')
})

test.cb('Each global state change triggers onUpdate()', t => {
    const initialModel = {
        data: {
            user: {},
            mutatedUser: {},
        },
    }

    let updateCounter = 0
    const expectedNames = [undefined, undefined, undefined, 'Ash', 'Bob', 'Cid']
    const context = createContext(initialModel, state => {
        t.is(expectedNames[updateCounter], state.data.user.name)
        t.is('Cid', state.data.mutatedUser.name)
        updateCounter += 1
        updateCounter === 3 && t.end()
    })

    const actions = context.connectActions(
        { user: ['data', 'user'] },
        {
            setName: name => model => {
                model.user = Object.assign({}, { name: name })
                return model
            },
        },
    )

    const mutatingActions = context.connectActions(
        { user: ['data', 'mutatedUser'] },
        {
            setName: name => model => {
                model.user.name = name
                return model
            },
        },
    )

    // Local model returned from action is treated as Promise.
    // So if we mutate the same reference in action (e.g. nested field in socket)
    // All synchronous mutations will occur before first promise resolves.
    // First onUpdate will already have 'Cid' here
    mutatingActions.setName('Ash')
    mutatingActions.setName('Bob')
    mutatingActions.setName('Cid')

    // Here each onUpdate will have different value because we create new value
    // instead of mutating it.
    actions.setName('Ash')
    actions.setName('Bob')
    actions.setName('Cid')
})

test.cb('triggerUpdate() function dispatches an empty Action', t => {
    const template = createTemplate({
        render: () => 'content',
    })
    const component = createComponent(template, {})
    const context = createContext({}, () => {
        t.is('content', instance())
        t.end()
    })
    const instance = createInstance(context, component)

    // Component does not have $init action, so no actions will be dispatched
    // automatically and Context won't be updated.

    context.triggerUpdate()
})

test.cb('createInstance() caches instances after first creation', t => {
    const template = createTemplate({
        sockets: ['counter'],
        actions: {
            $init: () => model => {
                model.counter += 1
                return model
            },
        },
        render: ({ model }) => {
            return model.counter
        },
    })

    const component = createComponent(template, {
        counter: ['counter'],
    })

    // Instantiation triggers $init action.
    // We instantiate twice, but expect counter to increment once.
    const context = createContext({ counter: 0 }, state => {
        const instance = context.createInstance(component, {})
        t.is(1, instance())
        t.end()
    })

    context.createInstance(component, {})
})
