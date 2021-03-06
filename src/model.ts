import { LocalModel } from './context'
import { Partial } from './component'
import uuid from 'uuid/v4'

// Function that decides if a field value is valid
export type ValidationFn = (value) => boolean
export type ValidationField = string | ValidationFn

// Model configuration
export type ModelConfig = {
    // Global State path to Model storage
    path?: string[]
    // If fields in not empty:
    // - only described fields are permitted
    // - all described fields are required
    fields?: { [key: string]: ValidationField }
    // If defaults is not empty:
    // - missing fields will be filled from default value
    defaults?: { [key: string]: any }
}

export type Model = {
    path: string[]
    get: (state: PartialModelState, id: string) => LocalModel
    all: (state: PartialModelState) => LocalModel[]
    filter: (
        state: PartialModelState,
        filter: (instance: LocalModel) => boolean,
    ) => LocalModel[]
    insert: (state: PartialModelState, instance: LocalModel) => string
    update: (
        state: PartialModelState,
        id: string,
        change: (instance: LocalModel) => LocalModel,
    ) => LocalModel
    remove: (state: PartialModelState, id: string) => boolean
    connect: (
        state: PartialModelState,
        field?: string | undefined,
    ) => ConnectedModel
}

export type ConnectedModel = {
    path: string[]
    get: (id: string) => LocalModel
    all: () => LocalModel[]
    filter: (filter: (instance: LocalModel) => boolean) => LocalModel[]
    insert: (instance: LocalModel) => string
    update: (
        id: string,
        change: (instance: LocalModel) => LocalModel,
    ) => LocalModel
    remove: (id: string) => boolean
}

export type ModelState = {
    collection?: LocalModel
}

export type PartialModelState = Partial<ModelState>

function modelPath(name: string) {
    return ['$model', name]
}

function get(state: PartialModelState, id: string): LocalModel {
    if (!state || !state.collection) return

    return state.collection[id]
}

function all(state: PartialModelState): LocalModel[] {
    if (!state || !state.collection) return []

    return Object.values(state.collection)
}

function filter(
    state: PartialModelState,
    filter: (instance: LocalModel) => boolean,
): LocalModel[] {
    if (!state || !state.collection) return []

    return Object.values(state.collection).filter(filter)
}

function insert(
    state: PartialModelState,
    config: ModelConfig,
    instance: LocalModel,
): string {
    instance = applyDefaults(config.defaults, instance)
    instance = validate(config.fields, instance)

    const id = uuid()
    if (!state) return
    if (!state.collection) state.collection = {}

    state.collection[id] = Object.assign(instance, { id })
    return id
}

function update(
    state: PartialModelState,
    config: ModelConfig,
    id: string,
    change: (instance: LocalModel) => LocalModel,
) {
    if (!state || !state.collection) return

    const user = get(state, id)
    if (!user) return

    const updatedUser = { ...validate(config.fields, change(user)), id }

    state.collection[id] = updatedUser

    return updatedUser
}

function remove(state: PartialModelState, id: string): boolean {
    if (!state || !state.collection) return

    if (!state.collection[id]) return false

    if (state.collection[id]) {
        delete state.collection[id]
        return true
    }
}

function validate(
    fields: { [key: string]: ValidationField } = {},
    instance: LocalModel,
): LocalModel {
    const fieldNames = Object.keys(fields)

    // When Model does not have fields we skip validation
    if (fieldNames.length === 0) return instance

    // When not all fields are present in instance we throw
    const missingFields = fieldNames.reduce((acc, name) => {
        return instance.hasOwnProperty(name) ? acc : [...acc, name]
    }, [])
    if (missingFields.length > 0)
        throw new Error(
            `Model instance is missing fields: ${missingFields.join(', ')}`,
        )

    // When not all fields are valid we throw
    const invalidFields = fieldNames.reduce((acc, name) => {
        const validator = fields[name]
        let valid = false

        if (typeof validator === 'string') {
            valid = typeof instance[name] === validator
        } else {
            valid = validator(instance[name])
        }

        if (!valid) return [...acc, name]

        return acc
    }, [])

    if (invalidFields.length > 0)
        throw new Error(
            `Model instance has invalid fields: ${invalidFields.join(', ')}`,
        )

    return fieldNames.reduce((acc, name) => {
        acc[name] = instance[name]
        return acc
    }, {})
}

function applyDefaults(
    defaults: { [key: string]: any } = {},
    instance: LocalModel,
) {
    const computedDefaults = Object.keys(defaults).reduce((acc, name) => {
        if (typeof defaults[name] === 'function') {
            acc[name] = defaults[name]()
        } else {
            acc[name] = defaults[name]
        }

        return acc
    }, {})

    return {
        ...computedDefaults,
        ...instance,
    }
}

function connect(
    state: LocalModel,
    field: string | undefined,
    model: Model,
): ConnectedModel {
    if (typeof field === 'string') {
        if (typeof state[field] !== 'object') state[field] = {}
        state = state[field]
    }
    return {
        path: model.path,
        get: id => model.get(state, id),
        all: () => model.all(state),
        filter: filterFn => model.filter(state, filterFn),
        insert: instance => model.insert(state, instance),
        update: (id, updateFn) => model.update(state, id, updateFn),
        remove: id => model.remove(state, id),
    }
}

export function createModel(name: string, config: ModelConfig = {}): Model {
    const model = {
        path: config.path || modelPath(name),
        get: (state, id) => get(state, id),
        all: state => all(state),
        filter: (state, filterFn) => filter(state, filterFn),
        insert: (state, instance) => insert(state, config, instance),
        update: (state, id, changeFn) => update(state, config, id, changeFn),
        remove: (state, id) => remove(state, id),
        connect: (state, field?) => connect(state, field, model),
    }

    return model
}
