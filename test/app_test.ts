import test from 'ava'
import {createTemplate, createComponent, createContext, createApp} from '../src/index'

test.cb('Single component app renders on global state updates', t => {
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
    const expectedNames = ['John', 'Ash', 'Bob', 'Cid']
    const app = createApp({name: 'John'}, component, (instance) => {
        t.is(expectedNames[updateCounter], instance())
        updateCounter += 1
        updateCounter === 3 && t.end()
    })

    app()

    // Need to wait for the next tick (promise needs to resolve before rerender)
    setTimeout(() => {
        setName('Ash')
        setName('Bob')
        setName('Cid')
    })
})
