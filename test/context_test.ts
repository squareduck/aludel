import test from 'ava'
import { createContext } from '../src/context'
import { createTemplate, createComponent, createInstance } from '../src/component'

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
        phone: ['details', 'contacts', 'phone']
    })

    t.deepEqual({
        name: 'John',
        hobby: 'music',
        hobbies: ['music', 'poetry'],
        city: undefined,
        phone: undefined,
    }, localModel)
})

test('Each global state change triggers onUpdate()', t => {
    /*
     * Extract connected action from render function.
     * Then call it repeatedly with different argument and expect each call
     * to trigger context onUpdate function.
     *
     * We check that global state actually was properly changed by action.
     */

    let setName
    const template = createTemplate({
        sockets: ['name'],
        actions: {
            setName: (name) => (model) => {
                model.name = name
                return model
            }
        },
        render: ({model, action}) => {
            // Extract this connected action into scope above on first render
            setName = action.setName
            return model.name
        }
    })

    const component = createComponent(template, {
        name: ['name']
    })

    let updateCounter = 0
    const expectedNames = ['Ash', 'Bob', 'Cid']
    const context = createContext({}, (state) => {
        t.is(expectedNames[updateCounter], state.name)
        updateCounter += 1
    })

    const instance = createInstance(context, component)

    // Does not call actions inside render, so no update yet
    instance()

    // This should call onUpdate each time
    setName('Ash')
    setName('Bob')
    setName('Cid')
})
