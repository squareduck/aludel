import flyd from 'flyd'
import * as R from 'ramda'
import Mapper from 'url-mapper'

export type Model = {[key: string]: any}
export type UpdateFn = (model: Model) => Model
export type RendererFn = (rootElement: HTMLElement, view: any) => any

export type Component = () => (tools: ViewTools) => any
export type SocketPaths = {[key: string]: string[]}
export type ComponentLenses = {[key: string]: R.Lens}
export type ComponentFoci = {[key: string]: any}
export type ComponentActions = {[key: string]: (...args: any[]) => UpdateFn} 

export interface ComponentTemplate {
    sockets: string[]
    actions: (tools: ActionTools) => ComponentActions
    view: (tools: ViewTools) => any
}

export interface ActionTools {
    foci: ComponentFoci
    lenses: ComponentLenses
}

export interface ViewTools {
    createComponent: Function
    foci: ComponentFoci
    actions: ComponentActions
}

export interface Route {
    name: string
    component: Component
    subroutes?: SubRoutes
    actions?: ((...args: any[]) => UpdateFn)[]
}

export interface SubRoute {
    name: string
    subroutes?: SubRoutes
    actions?: ((...args: any[]) => UpdateFn)[]
}

export interface FlatRoute {
    name: string
    component: Component
    actions?: ((...args: any[]) => UpdateFn)[]
}

export type Routes = {[key: string]: Route}
export type SubRoutes = {[key: string]: SubRoute}
export type FlatRoutes = {[key: string]: FlatRoute}
export interface Router {
    defaultRoute: string
    defaultRouteParams: {[key: string]: any}
    navigate: {[key: string]: Function}
    routes: FlatRoutes
}


export const createApp = (initialModel: Model, renderer: RendererFn) => {
    const urlMapper = Mapper()

    const updateStream = flyd.stream<UpdateFn>()

    const applyUpdate = (currentModel: Model, modelUpdate: UpdateFn) => modelUpdate(currentModel)
    const modelStream = flyd.scan<Model, UpdateFn>(applyUpdate, initialModel, updateStream)

    let topComponent = () => ({})

    const createComponent = (template: ComponentTemplate, paths: SocketPaths): Component => {

        const lenses = R.reduce<string, ComponentLenses>(
            (acc, socket) => R.assoc(socket, R.lensPath(paths[socket]), acc),
            {},
            template.sockets
        )

        const foci   = R.reduce<string, ComponentFoci>(
            (acc, socket) => R.assoc(socket, () => R.view(lenses[socket], modelStream()), acc),
            {},
            template.sockets
        )

        const actionMap = template.actions({foci, lenses})
        const actions = R.reduce<string, ComponentActions>(
            (acc, action) => R.assoc(action, (...args: any[]) => updateStream(actionMap[action](...args)), acc),
            {},
            R.keys(actionMap)
        )

        return () => template.view({createComponent, foci, actions})
    }

    const createRouter = (routes: Routes): Router => {
        const flattenSubroutes = (component: Component, parentPath: string, subroutes: SubRoutes): FlatRoutes => R.reduce(
            (acc, path) => {
                const fullPath = parentPath + path
                const route = subroutes[path]
                acc = R.assoc(fullPath, {
                    name: route.name,
                    component: component,
                    actions: route.actions,
                }, acc)

                if (route.subroutes) {
                    return R.merge(acc, flattenSubroutes(component, fullPath, route.subroutes))
                } 

                return acc
            }, {}, R.keys(subroutes))

        const flatRoutes: FlatRoutes = R.reduce((acc, path) => {
            const route = routes[path]
            acc = R.assoc(path, {
                name: route.name,
                component: route.component,
                actions: route.actions,
            }, acc)

            if (route.subroutes) {
                return R.merge(acc, flattenSubroutes(route.component, path, route.subroutes))
            }

            return acc
        }, {}, R.keys(routes))

        const navigate = R.reduce((acc, path) => {
            const route = flatRoutes[path]
            return R.assoc(route.name, (params: {[key: string]: any}) => {
                topComponent = route.component
                window.history.pushState({}, '', '#' + urlMapper.stringify(path, params || {}))
                updateStream(model => {
                    model = R.set(R.lensPath(['router', 'current']), route.name, model)
                    model = R.set(R.lensPath(['router', 'pages', route.name]), params || {}, model)
                    return model
                })
                route.actions && route.actions.forEach(action => updateStream(action(params || {})))
            }, acc)
        }, {}, R.keys(flatRoutes))

        return {
            defaultRoute: 'Main',
            defaultRouteParams: {},
            navigate,
            routes: flatRoutes,
        }
    }

    const start = (rootElement: HTMLElement, router: Router | Component) => {
        if (typeof router === 'function') {
            topComponent = router
        } else {
            window.onpopstate = () => {
                const route = document.location.hash.substring(1)
                const resolved = urlMapper.map(route, router.routes)
                if (resolved) router.navigate[resolved.match.name](resolved.values)
            }

            router.navigate[router.defaultRoute](router.defaultRouteParams)
        }

        modelStream.map(model => {
            console.log(model)
            renderer(rootElement, topComponent)
        })

        window.n = router.navigate
    }

    return {
        createComponent,
        createRouter,
        start,
        focus,
    }
}
