package kr.roopre.iringer_app.navigation

sealed class NavRoute(val route: String) {
    object Login : NavRoute("login")
    object Main : NavRoute("main")
}