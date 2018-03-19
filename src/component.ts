import { Context, Model, ConnectedActionMap } from './context'

export type Partial<T> = { [P in keyof T]?: T[P] }

/*
 * Create template
 */

export type Template = {
    sockets: string[]
    actions: { [key: string]: Action }
    render: (tools: RenderTools) => any
}


export type RenderTools = {
    model: Model
    actions: ConnectedActionMap
}

export type Action = (...args) => (model: Model) => Model
export type ActionMap = { [key: string]: Action }

export function createTemplate(config: Partial<Template>): Template {
    return Object.assign(
        {
            sockets: [],
            actions: {},
            render: () => {},
        },
        config,
    )
}

/*
 * Create component
 */

export type PathMap = { [key: string]: (string | number)[] }

export type Component = {
    template: Template
    paths: PathMap
}

export function createComponent(template: Template, paths: PathMap): Component {
    // Check that we have same amount of paths and sockets
    const equalAmount = Object.keys(paths).length === template.sockets.length
    // Check that we have a path for each socket
    const allSocketsCovered =
        template.sockets.filter(
            socket => Object.keys(paths).indexOf(socket) < 0,
        ).length === 0
    // If either is false we throw error
    if (!equalAmount || !allSocketsCovered)
        throw new Error(`Paths and sockets don't match.`)

    return {
        template,
        paths
    }
}

/*
 * Create instance
 */

export type Instance = () => any

export function createInstance(
    context: Context,
    component: Component,
): Instance {
    return () => {
        const model = context.localModel(component.paths)
        const actions = context.connectActions(component.paths, component.template.actions)
        return component.template.render({ model, actions })
    }
}
