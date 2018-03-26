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

test.cb('Doesnt calculate render function if deps didnt change', t => {
    let homeRenders = 0
    let userRenders = 0
    let bookRenders = 0

    let homeAction
    let userAction
    let bookAction

    let renderCount = 0
    const context = createContext({}, state => {
        homeInstance()
        userInstance()
        bookInstance()
        renderCount += 1
        if (renderCount === 1) {
            t.is(homeRenders, 2)
            t.is(userRenders, 2)
            t.is(bookRenders, 2)
        }
        if (renderCount === 2) {
            t.is(homeRenders, 3)
            t.is(userRenders, 3)
            t.is(bookRenders, 2)
        }
        if (renderCount === 3) {
            t.is(homeRenders, 4)
            t.is(userRenders, 3)
            t.is(bookRenders, 3)
            t.end()
        }
    })

    const homeTemplate = createTemplate({
        sockets: ['userList', 'bookList'],
        actions: {
            action: () => model => model,
        },
        render: ({ action }) => {
            homeAction = action.action
            homeRenders += 1
            return 'Home'
        },
    })
    const homeComponent = createComponent(homeTemplate, {
        userList: ['data', 'users', 'list'],
        bookList: ['data', 'books', 'list'],
    })

    const homeInstance = createInstance(context, homeComponent)

    const userTemplate = createTemplate({
        sockets: ['users'],
        actions: {
            action: () => model => model,
        },
        render: ({ action }) => {
            userAction = action.action
            userRenders += 1
            return 'User'
        },
    })
    const userComponent = createComponent(userTemplate, {
        users: ['data', 'users'],
    })

    const userInstance = createInstance(context, userComponent)

    const bookTemplate = createTemplate({
        sockets: ['books'],
        actions: {
            action: () => model => model,
        },
        render: ({ action }) => {
            bookAction = action.action
            bookRenders += 1
            return 'Book'
        },
    })
    const bookComponent = createComponent(bookTemplate, {
        books: ['data', 'books'],
    })

    const bookInstance = createInstance(context, bookComponent)

    homeInstance()
    userInstance()
    bookInstance()

    homeAction()
    userAction()
    bookAction()
})
