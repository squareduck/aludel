import test from 'ava'
import { createModel } from '../src/model'

test('createModel() exposes path', t => {
    const model = createModel('User')
    t.deepEqual(model.path, ['$model', 'User'])
})
