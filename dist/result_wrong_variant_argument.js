


function Ok(value){return {tag:"Ok", value}}
function Err(value){return {tag:"Err", value}}
function Some(value){return {tag:"Some", value}}
function None(value){return {tag:"None", value}}
function takesResult(r) {

}
function main() {
takesResult(Some(42))
}
