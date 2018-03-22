import test from 'ava'
import {createTemplate, createComponent, createRoutedApp} from '../src/index'

test.skip('App can take routing configuration instead of top component', t => {
    const template = createTemplate({
        render: () => 'HOME'
    })

    const component = createComponent(template, {})

    const routing = {
        '/': {
            name: 'Home',
            component: component
        }
    }

    const app = createRoutedApp({}, routing, (instance) => {
        t.is('HOME', instance())
    })
})
