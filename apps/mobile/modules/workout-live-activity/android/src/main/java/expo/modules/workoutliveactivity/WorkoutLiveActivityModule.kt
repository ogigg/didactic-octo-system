package expo.modules.workoutliveactivity

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WorkoutLiveActivityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WorkoutLiveActivity")

    AsyncFunction("areActivitiesEnabled") { false }
    AsyncFunction("startActivity") { _: String, _: Map<String, Any?> -> null as String? }
    AsyncFunction("updateActivity") { _: Map<String, Any?> -> }
    AsyncFunction("endActivity") { _: Boolean -> }
  }
}
