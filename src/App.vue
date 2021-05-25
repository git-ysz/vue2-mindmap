<template>
  <v-app>
    <v-main>
      <v-container fluid class="fill-height">
        <v-card outlined class="fill-height" width="100%">
          <v-sheet class="fill-height">
            <v-row no-gutters class="fill-height">
              <mindmap
                v-model="mmdata"
                ref="mind"
                @updateNodeName="updateNodeName"
                @click="click"
                @change="change"
              ></mindmap>
            </v-row>
          </v-sheet>
        </v-card>
      </v-container>
    </v-main>
  </v-app>
</template>

<script lang="ts">
import { Vue, Component } from 'vue-property-decorator'
import dataLearn from '../public/learn.json'
import mindmap from './components/MindMap.vue'

@Component({ components: { mindmap } })
export default class App extends Vue {
  mmdata = dataLearn
  updateNodeName(...args: any) {
    // console.log('updateNodeName', ...args)
  }
  click(...args: any) {
    // console.log('click', ...args)
  }
  change(...args: any) {
    // console.log('change', ...args)
  }
  mounted() {}
}
</script>

<style>

</style>
