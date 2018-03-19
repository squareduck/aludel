import test from 'ava'
import { createContext } from '../src/context'

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
