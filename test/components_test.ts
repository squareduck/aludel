import test from 'ava'
import {
    createTemplate,
    createComponent,
    createInstance,
} from '../src/component'
import { createContext } from '../src/context'

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

test('New local model returned from action is applied back to global state', t => {
    /*
     * Two components have a socket with the same path ['person', 'age'].
     *
     * actionComponent has a render function which:
     * - Calls an action that modifies the 'age' field in local model
     * - Renders the 'age' field from local model
     *
     * watcherComponent just renders the 'age' field from its own local model.
     *
     * First we check that action did not mutate local model inside current
     * render function (actionComponent instance rendered initial age).
     *
     * Then we check that watcherInstance got updated age in its own local
     * model.
     *
     * And finally we render actionComponent again to trigger its action and
     * check if everything is updated as expected.
     *
     */

    const actionTemplate = createTemplate({
        sockets: ['name', 'age'],
        actions: {
            growUp: count => model => {
                model.age += count
                return model
            },
        },
        render: ({ model, action }) => {
            action.growUp(9)
            return model.name + ' ' + model.age
        },
    })

    const actionComponent = createComponent(actionTemplate, {
        name: ['person', 'name'],
        age: ['person', 'age'],
    })

    const watcherTemplate = createTemplate({
        sockets: ['age'],
        render: ({ model }) => {
            return model.age
        },
    })

    const watcherComponent = createComponent(watcherTemplate, {
        age: ['person', 'age'],
    })

    const initialState = {
        person: {
            name: 'John',
            age: 21,
        },
    }

    const context = createContext(initialState)

    const actionInstance = createInstance(context, actionComponent)
    const watcherInstance = createInstance(context, watcherComponent)

    t.is('John 21', actionInstance())

    t.is(30, watcherInstance())

    t.is('John 30', actionInstance())

    t.is(39, watcherInstance())
})

test('Changes to local model produce new state (local immutability)', t => {
    /*
     * Two fields in initialModel are referencing the same array.
     * We make sure that mutation of local model inside action affects
     * only one field according to corresponding path.
     *
     * actionComponent has a socket with path to initialModel.mutatedList
     *
     * watcherComponent has sockets for both mutatedList and referenceList
     *
     * At the start both lists reference the same array.
     *
     * But as soon as we mutate one list in action, it becomes a new value
     * and no longer shares a reference with original list.
     *
     * We prove it by pushing into array and checking array lengths.
     *
     * This means that we can mutate local model and still simulate global
     * state immutability.
     *
     *
     */
    const actionTemplate = createTemplate({
        sockets: ['list'],
        actions: {
            add: value => model => {
                model.list.push(value)
                return model
            },
        },
        render: ({ model, action }) => {
            action.add('value')
            return model.list.length
        },
    })

    const actionComponent = createComponent(actionTemplate, {
        list: ['mutatedList'],
    })

    const watcherTemplate = createTemplate({
        sockets: ['mutated', 'reference'],
        render: ({ model }) => {
            return {
                mutated: model.mutated.length,
                reference: model.reference.length,
            }
        },
    })

    const watcherComponent = createComponent(watcherTemplate, {
        mutated: ['mutatedList'],
        reference: ['referenceList'],
    })

    const listSource = []
    const initialModel = {
        mutatedList: listSource,
        referenceList: listSource,
    }

    const context = createContext(initialModel)

    const actionInstance = createInstance(context, actionComponent)
    const watcherInstance = createInstance(context, watcherComponent)

    t.is(0, actionInstance())

    t.deepEqual(
        {
            mutated: 1,
            reference: 0,
        },
        watcherInstance(),
    )
})

test.skip('Actions can return promises', t => {
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
        render: ({model, action}) => {
            connectedAction = action.asyncIncrement
            return model.counter
        }
    })

    const component = createComponent(template, {
        counter: ['counter']
    })

    let renderCount = 0
    let expectedValues = [50, 100, 150]
    const context = createContext({counter: 0}, (state) => {
        t.is(expectedValues[renderCount], state.counter)
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
