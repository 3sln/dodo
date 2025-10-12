(ns custom-dodo
  (:require ["@3sln/dodo" :as dodo-core]))

(def dodo-settings
  #js {
    :shouldUpdate (fn [a b] (not= a b))
    
    :isMap (fn [x] (or (map? x) (and (object? x) (= (.-constructor x) js/Object))))
    :mapIter (fn [m] (if (map? m) 
                     (es6-iterator (map #(into-array %) (seq m)))
                     (js/Object.entries m)))
    :mapGet (fn [m k] 
              (if (map? m) 
                (if (string? k)
                  (or (get m k) (get m (keyword k)))
                  (get m k))
                (aget m k)))
    :mapMerge (fn [& maps] (apply merge maps))
    :newMap (fn [obj] (if (map? obj) obj (js->clj obj :keywordize-keys true)))
    :mapPut (fn [m k v] (if (map? m) (assoc m k v) (do (aset m k v) m)))
    
    :isSeq (fn [x] (or (and (seqable? x) (not (string? x))) (js/Array.isArray x)))
    :seqIter (fn [s] (if (seqable? s) (es6-iterator s) s))
    
    :convertName name
    :listenerKey :listener
    :captureKey :capture
    :passiveKey :passive
  })

(def d (dodo-core/dodo dodo-settings))

(def my-component (d/alias (fn [text]
  (d/div
    (d/h1 "Hello from ClojureScript!")
    (d/p "The text is: " text)))))

(defn ^:export default [driver]
  (let [text$ (.property driver "Text" #js {:defaultValue "dynamic text"})]
    (.panel driver "Demo" 
      (fn [container signal]
        (let [sub (.subscribe text$ (fn [text]
          (d/reconcile container [(my-component text)])))]
          (.addEventListener signal "abort" #(.unsubscribe sub)))))))
