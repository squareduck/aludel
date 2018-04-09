import test from 'ava'
import { createModel } from '../src/model'

test('createModel().path returns model path for Global State', t => {
    const model = createModel('User')
    t.deepEqual(model.path, ['$model', 'User'])
})

test('createModel().insert() puts value in model collection', t => {
    const state = {}
    const model = createModel('User')
    const id = model.insert(state, { name: 'John', age: 21 })

    t.deepEqual(state['collection'][id], { id, name: 'John', age: 21 })
})

test('createModel().insert() respects default values', t => {
    const state = {}
    const model = createModel('User', {
        defaults: {
            name: 'Default',
            age: () => 21,
        },
    })

    const id = model.insert(state, { email: 'test@example.com' })

    t.deepEqual(model.get(state, id), {
        id,
        name: 'Default',
        age: 21,
        email: 'test@example.com',
    })
})

test('createModel().insert() respects validation', t => {
    const state = {}
    const model = createModel('User', {
        fields: {
            name: 'string',
            age: n => n > 20,
            email: 'string',
        },
    })

    // Checks that all fields are present
    const amountErr = t.throws(() => {
        model.insert(state, {
            name: 'John',
        })
    })
    t.is(amountErr.message, 'Model instance is missing fields: age, email')

    // Runs validators for all fields
    const ageErr = t.throws(() => {
        model.insert(state, {
            name: 'John',
            age: 15,
            email: null,
        })
    })
    t.is(ageErr.message, 'Model instance has invalid fields: age, email')

    // Ignores unspecified fields in instance
    const id = model.insert(state, {
        name: 'John',
        age: 21,
        email: 'test@example.com',
        hobby: 'music',
    })
    t.deepEqual(model.get(state, id), {
        id,
        name: 'John',
        age: 21,
        email: 'test@example.com',
    })
})

test('createModel().insert() applies defaults before validation', t => {
    const state = {}
    const model = createModel('User', {
        fields: {
            name: 'string',
            age: n => n > 20,
        },
        defaults: {
            name: 'Default',
            age: 21,
        },
    })

    const ageErr = t.throws(() => {
        model.insert(state, {
            age: 18,
        })
    })
    t.is(ageErr.message, 'Model instance has invalid fields: age')

    const id = model.insert(state, {})

    t.deepEqual(model.get(state, id), {
        id,
        name: 'Default',
        age: 21,
    })
})

test('createModel().get() searches instance by id', t => {
    const state = {}
    const model = createModel('User')
    const id = model.insert(state, { name: 'John', age: 21 })

    const user = model.get(state, id)

    t.deepEqual(user, state['collection'][id])
})

test('createModel().filter() filters instances by function', t => {
    const state = {}
    const model = createModel('User')

    const johnId = model.insert(state, { name: 'John', age: 21 })
    const ashId = model.insert(state, { name: 'Ash', age: 18 })
    const bobId = model.insert(state, { name: 'Bob', age: 32 })

    t.deepEqual(model.filter(state, i => i.age > 20), [
        model.get(state, johnId),
        model.get(state, bobId),
    ])

    t.deepEqual(model.filter(state, i => i.age < 20), [model.get(state, ashId)])

    t.deepEqual(model.filter(state, i => i.age === 20), [])
})

test('createModel().update() mutates instance by id', t => {
    const state = {}
    const model = createModel('User')

    const id = model.insert(state, { name: 'John', age: 21 })

    const updatedUser = model.update(state, id, user => {
        user.name = 'Johny'
        return user
    })

    t.is(updatedUser.id, id)
    t.is(updatedUser.name, 'Johny')
    t.is(updatedUser.age, 21)

    const john = model.get(state, id)

    t.is(john.name, 'Johny')
    t.is(john.age, 21)
})

test('createModel().update() respects validation', t => {
    const state = {}
    const model = createModel('User', {
        fields: {
            name: 'string',
            age: n => n > 20,
            email: 'string',
        },
    })

    const id = model.insert(state, {
        name: 'John',
        age: 21,
        email: 'test@example.com',
    })

    // Checks that all fields are present
    const amountErr = t.throws(() => {
        model.update(state, id, user => {
            return { name: user.name }
        })
    })
    t.is(amountErr.message, 'Model instance is missing fields: age, email')

    // Runs validators on all fields
    const ageErr = t.throws(() => {
        model.update(state, id, user => {
            return { ...user, age: 18 }
        })
    })
    t.is(ageErr.message, 'Model instance has invalid fields: age')
    t.is(model.get(state, id).age, 21)

    // Ignores unspecified fields in instance
    const newUser = model.update(state, id, user => ({
        ...user,
        age: 27,
        hobby: 'music',
    }))

    t.deepEqual(newUser, {
        id,
        name: 'John',
        age: 27,
        email: 'test@example.com',
    })

    t.deepEqual(model.get(state, id), newUser)
})

test('createModel().remove() deletes instance from collection by id', t => {
    const state = {}
    const model = createModel('User')

    t.is(model.remove(state, 'nosuchid'), undefined)

    const id = model.insert(state, { name: 'John', age: 21 })

    t.is(model.remove(state, 'nosuchid'), false)

    const result = model.remove(state, id)

    t.is(result, true)
    t.is(model.get(state, id), undefined)
})
